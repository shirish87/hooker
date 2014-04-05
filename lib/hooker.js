
var EventEmitter = require('events').EventEmitter
  , _ = require('lodash')
  , debug = require('debug')('hooker')


var defaultEvents = [ 'done', 'error' ];

var defaultOptions = {
    maxPriority: 20
};

var DEF_PRIORITY = 5;
var DEFAULT_TIMEOUT = 5000;
var EVENT_ERROR = 'error';


function Hooker(events, options) {
    // allow initialization without a new prefix
    if (!(this instanceof Hooker)) return new Hooker(events, options);

    events = Array.isArray(events) ? events : defaultEvents;

    if (events.indexOf(EVENT_ERROR) < 0) {
        events.push(EVENT_ERROR);
    }

    this._events = events;
    this._options = options || defaultOptions;
    this._state = {};
    this._eventEmitter = new EventEmitter();
    this._eventEmitter.setMaxListeners(50);

    this.isSealed = false;
}



Hooker.prototype.checkIfSealed = function () {
    if (this.isSealed) {
        this._raiseError('Listeners sealed');
    }
}


Hooker.prototype._raiseError = function (err) {
    console.log('arguments', arguments)
//    this.emit(EVENT_ERROR, new Error(err));
}


Hooker.prototype.on = function (event, opts, fn) {
    this.checkIfSealed();

    // function(event, fn)
    if (!fn && typeof opts === 'function') {
        fn = opts;
        opts = {};
    }

    if (typeof fn !== 'function') {
        this._raiseError('Expected callback to be a function');
        return;
    }

    if (this._events.indexOf(event) < 0) {
        this._raiseError('Unrecognized event: ' + event);
        return;
    }

    var name = (typeof opts.name === 'string') ? opts.name : '';
    var timeout = (typeof opts.timeout === 'number') ? opts.timeout : 0;
    var priority = (typeof opts.priority === 'number') ? opts.priority : DEF_PRIORITY;

    if (priority > this._options.maxPriority) {
        this._raiseError('Priority exceeds maximum allowed: ' + this._options.maxPriority);
        return;
    }


    if (!this._state.hasOwnProperty(event)) {
        this._state[event] = [];
        debug('creating new event: ' + event);
    }

    var hookData = {
        event: event
      , priority: priority
      , name: name
      , callback: fn
    };

    if (timeout > 0) {
        hookData.waitTimeout = timeout;
        hookData.waitTimer = null;
        debug('registered timeout value');
    }

    this._state[event].push(hookData);
    debug('stored event: ' + event);
}


Hooker.prototype.emit = function () {
    if (!this.isSealed) {
        console.warn('warning: implicit seal applied');
        this.seal();
    }

    var srcArgs = Array.prototype.slice.call(arguments);
    var event = srcArgs[0];
    debug('emit: ' + event);

    var self = this;

    if (this._state.hasOwnProperty(event)) {
        var targetHooks = this._state[event];

        for (var i = 0, l = targetHooks.length; i < l; i++) {
            var hookData = targetHooks[i];

            if (hookData.waitTimeout) {
                debug('setting timeout for event: ' + event + ' (' + hookData.waitTimeout + ')');

                hookData.waitTimer = setTimeout(function waitTimer() {
                    self._raiseError('Timeout waiting for event: ' + event);
                    debug('timeout occurred');
                }, hookData.waitTimeout);
            }
        }
    }

    this._eventEmitter.emit.apply(this._eventEmitter, srcArgs);
    debug('emitting event: ' + event);
}


Hooker.prototype.seal = function () {
    debug('seal');

    if (typeof this._state !== 'object') {
        this._raiseError('Invalid state');
        return;
    }

    this._eventEmitter.removeAllListeners();

    var self = this;
    var state = this._state;


    for (var event in state) {
        if (state.hasOwnProperty(event)) {
            state[event].sort(fnSortByPriority);
            console.log(event, state[event])

            for (var i = 0, l = state[event].length; i < l; i++) {
                var hookData = state[event][i];
                debug('added event: ' + event);

                self._eventEmitter.on(event, function () {
                    var srcArgs = Array.prototype.slice.call(arguments);
                    debug('received event: ' + event + ' | ' + JSON.stringify(this));

                    if (hookData.waitTimeout) {
                        debug('attaching done fn');

                        srcArgs.push(function done(err) {
                            if (err) {
                                debug('execution error: ' + err);
                                self.emit(EVENT_ERROR, err);
                            }

                            if (hookData.waitTimer) {
                                debug('clearing timeout: ' + event);
                                clearTimeout(hookData.waitTimer);
                            }
                        });
                    }

                    hookData.callback.apply(self, srcArgs);
                });
            }
        }
    }

    this.isSealed = true;
}


function fnSortByPriority(a, b) {
    return a.priority - b.priority;
}


/*!
 * Module exports.
 */

module.exports = exports = Hooker;