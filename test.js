#!/usr/bin/env node
"use strict";

var subdivx = require('./subdivx')({ debug: false });
// tests
subdivx.downloadSubtitle(
    'the big bang theory s07e06',
    ['dimension', 'argenteam'],
    './',
    function () {
        console.log('this is the callback after the subtitle is downloaded and decompressed');
    }
);

subdivx.searchShow('halt and catch fire', function (results) {
    console.log('searchShow().response:', {
        lengh: results.length,
        data: results
    });
});

subdivx.searchShowRelease(
    'the wolverine',
    ['yify', '1080p', 'argenteam'],
    function (results) {
        console.log('searchShowRelease().response:', results);
    }
);
