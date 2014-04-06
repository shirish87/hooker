

var Hooker = require('../lib/hooker')
  , chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect


var clock;

beforeEach(function () {
     clock = sinon.useFakeTimers();
 });

afterEach(function () {
    clock.restore();
});



describe("Module Load", function () {

    it("Completes without timeout", function (done) {
        var hooker = new Hooker();
        hooker.hook('done', function (app, config) {
            done();
        });

        hooker.invoke('done', {}, {});
    });


    it("Completes with timeout", function (done) {
        var hooker = new Hooker();
        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(999);

            complete();
            done();
        });

        hooker.invoke('done', {}, {});
    });


    it("Completes within timeout", function (done) {
        var hooker = new Hooker();
        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(999);

            complete();
            done();
        });

        hooker.invoke('done', {}, {});
    });

    it("Throws error on timeout", function (done) {
        var hooker = new Hooker(function (err) {
            expect(err).to.be.an('object');
            expect(err.message).to.equal('Timeout waiting for event: done');
            done();
        });

        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(1001);
            complete();
        });

        hooker.seal();
        hooker.invoke('done', {}, {});
    });


    it("Handles multiple hooks", function (done) {
        var hooker = new Hooker(function (err) {
            expect(err).to.be.an('undefined');
            done();
        });

        hooker.hook('event1', { track: true }, function (complete) {
            clock.tick(1000);
            console.log('event1 invoked');
            complete();
        });

        hooker.hook('event2', function () {
            clock.tick(1000);
            console.log('event2 invoked');
        });

        hooker.hook('event3', { timeout: 1000 }, function (app, config, complete) {
            console.log('event3 invoked');
            clock.tick(999);
            complete();
        });

        console.log('INVOKING event3');
        hooker.invoke('event3', {}, {});

        console.log('INVOKING event1');
        hooker.invoke('event1');

        console.log('INVOKING event2');
        hooker.invoke('event2');
    });


    it("Invokes multiple hooks in priority-order", function (done) {
        var hooker = new Hooker(function (err) {
            expect(err).to.be.an('undefined');
            done();
        });

        hooker.hook('event1', { priority: 6 }, function () {
            console.log('event1 p6 invoked');
        });

        hooker.hook('event1', { priority: 4, track: true }, function (complete) {
            console.log('event1 p4 invoked');
            complete();
        });

        hooker.hook('event1', { priority: 10 }, function () {
            console.log('event1 p10 invoked');
        });

        hooker.hook('event2', function () {
            console.log('event2 p5 (default) invoked');
        });

        hooker.hook('event2', { priority: 10 }, function () {
            console.log('event2 p10 invoked');
        });

        hooker.hook('event3', function () {
            console.log('event3 p5 (default) invoked');
        });

        hooker.invoke('event1');
        hooker.invoke('event2');
        hooker.invoke('event3');
    });
});