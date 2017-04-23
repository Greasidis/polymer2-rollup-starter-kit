(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.app = global.app || {})));
}(this, (function (exports) { 'use strict';

function tests() {
    console.log('test');
}

tests();

function test() {
    console.log('test');
}

test();

exports.test = test;

Object.defineProperty(exports, '__esModule', { value: true });

})));
