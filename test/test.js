

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

    it("Completes without timeout", function (done) {
        var hooker = new Hooker(['done']);
        hooker.hook('done', function (app, config) {
            done();
        });

        hooker.invoke('done', {}, {});
    });


    it("Completes with timeout", function (done) {
        var hooker = new Hooker(['done']);
        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(999);

            complete();
            done();
        });

        hooker.invoke('done', {}, {});
    });


    it("Completes within timeout", function (done) {
        var hooker = new Hooker(['done']);
        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(999);

            complete();
            done();
        });

        hooker.invoke('done', {}, {});
    });

    it("Throws error on timeout", function (done) {
        var hooker = new Hooker(['done']);

        hooker.hook('done', { timeout: 1000 }, function (app, config, complete) {
            clock.tick(1001);
            complete();
        });

        hooker.hook('error', function (err) {
            expect(err).to.be.an('object');
            expect(err.toString()).to.equal('Error: Timeout waiting for event: done');
            done();
        });

        hooker.seal();
        hooker.invoke('done', {}, {});
    });
});