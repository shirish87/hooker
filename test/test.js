

var Hooker = require('../lib/hooker')
  , chai = require('chai')
  , sinon = require('sinon')
  , assert = chai.assert
  , expect = chai.expect


var clock;

beforeEach(function () {
     clock = sinon.useFakeTimers();
 });

afterEach(function () {
    clock.restore();
});



describe("Module Load", function () {

//    it("Completes without timeout", function (done) {
//        var hooker = new Hooker(['done']);
//        hooker.on('done', function (app, config) {
//            done();
//        });
//
//        hooker.emit('done', {}, {});
//    });
//
//
//    it("Completes with timeout", function (done) {
//        var hooker = new Hooker(['done']);
//        hooker.on('done', { timeout: 1000 }, function (app, config, complete) {
//            clock.tick(999);
//
//            complete();
//            done();
//        });
//
//        hooker.emit('done', {}, {});
//    });
//
//
//    it("Completes within timeout", function (done) {
//        var hooker = new Hooker(['done']);
//        hooker.on('done', { timeout: 1000 }, function (app, config, complete) {
//            clock.tick(999);
//
//            complete();
//            done();
//        });
//
//        hooker.emit('done', {}, {});
//    });

    it("Throws error on timeout", function (done) {
        var hooker = new Hooker(['done']);

        hooker.on('done', { timeout: 500 }, function (app, config, complete) {
            console.log('ondone', arguments);
            clock.tick(1005);
//            complete();
        });

        hooker.on('error', function (err) {
            console.log('onerror', arguments);
            expect(err).to.be.an('object');
            done();
        });

        hooker.seal();
        hooker.emit('done', {}, {});
    });
});