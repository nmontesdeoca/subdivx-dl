var path = require('path'),
    http = require('http'),
    child_process = require('child_process'),
    request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    unzip = require('unzip'),
    _ = require('underscore'),
    Q = require('Q'),

    DEBUG = false,
    URL = '/index.php?buscar={{SEARCH_TERM}}&accion=5&masdesc=&subtitulos=1&realiza_b=1';

function log() {
    if (DEBUG) {
        console.log.apply(this, arguments);
    }
}

function getURL(searchTerm) {
    return URL.replace(/{{SEARCH_TERM}}/, encodeURIComponent(searchTerm));
}

function mapResult($, item) {
    var $item = $(item),
        $details = $item.next(),
        $detailsSubData = $details.find('#buscador_detalle_sub_datos');

    return {
        title: $item.find('a').text().replace('Subtitulo de', ''),
        details: $details.find('#buscador_detalle_sub').text(),
        downloads: $detailsSubData.text().match(/Downloads: (\d*)/)[1],
        url: $detailsSubData.find('a').last().attr('href')
    };
}

function parseResponse(html) {
    var deferred = Q.defer(),
        htmlToProcess = html.substring(
            html.indexOf('<div class="pagination">'),
            html.lastIndexOf('<div class="pagination">')
        ),
        items,
        results = [];

    log('parsing results');

    $ = cheerio.load(htmlToProcess);

    items = $('div#menu_detalle_buscador');
    log('results found', items.length);
    results = _.toArray(items).map(_.partial(mapResult, $));

    deferred.resolve(results);

    return deferred.promise;
}

function downloadSubtitle(show, releaseDetails, outputPath, callback) {
    searchShowRelease(show, releaseDetails, function (results) {
        var first,
            url,
            tmp,
            tmpStream;

        if (!results.length) {
            console.log('No subs found for (' + show + '), try with less details');
            return;
        }

        first = results[0];

        console.log('Downloading:', first.title);
        console.log(first.details);

        url = first.url;
        tmp = path.resolve(path.join(outputPath, 'tmp_sub'));
        tmpStream = fs.createWriteStream(tmp);

        request(url)
        .on('end', function () {
            var type = this.response.headers['content-type'];
            decompressFor(type)(tmp, outputPath, function () {
                fs.unlink(tmp); // delete
                callback();
            });
        })
        .pipe(tmpStream);
    });
}

function searchShowRelease(show, releaseDetails, callback) {
    var and = function (predicates) {
            return function (e) {
                return _.every(predicates, function (p) {
                    return p(e);
                });
            };
        },
        conditions = releaseDetails.map(function(release) {
            return function(match) {
                return match.details.indexOf(release) != -1;
            };
        }),
        matchsRelease = and(conditions);

    searchShow(show, function (showMatches) {
        var releaseMatches = showMatches.filter(matchsRelease);
        callback(releaseMatches);
    });
}

function searchShow(show, callback) {
    // TODO: retrieve more pages until matches
    var url = getURL(show),
        options = {
            host: 'subdivx.com',
            path: url
        };

    http.request(options, function(response) {
        var body = '';

        response
        .on('data', function (chunk) {
            body += chunk;
        })
        .on('end', function () {
            parseResponse(body).then(callback, function (error) {
                throw new Error(error);
            });
        });
    }).end();
}

function decompress_rar(inputPath, outputPath, callback) {
    child_process.spawn(
        'unrar',
        [
            'e',
            '-y',
            inputPath
        ],
        {
            cwd: outputPath
        }
    ).on('close', callback);
}

function decompress_zip(inputPath, outputPath, callback) {
    fs.createReadStream(inputPath)
        .pipe(unzip.Extract({
            path: outputPath
        }))
        .on('close', callback);
}

function decompressFor(type) {
    if (type.indexOf('rar') != -1) {
        return decompress_rar;
    } else if (type.indexOf('/zip') != -1) {
        return decompress_zip;
    }

    throw new Error('Type ('+ type +') not supported');
}

module.exports = function (options) {
    if (options && options.debug) {
        DEBUG = true;
        request.debug = true;
    }

    return {
        searchShow: searchShow,
        searchShowRelease: searchShowRelease,
        downloadSubtitle: downloadSubtitle
    };
};
