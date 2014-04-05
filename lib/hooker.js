
var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('hooker')


var defaultEvents = [ 'done', 'error' ];

var defaultOptions = {
    maxPriority: 20
};

var DEF_PRIORITY = 5;
var EVENT_ERROR = 'error';


/**
 * Cached prototype for performance
 */
var slice = Array.prototype.slice;


/**
 * Creates a new hooker
 * @param events  {String[]}  List of hooks that will be handled
 * @param options {Object}    Options that override defaults: maxPriority.
 * @returns {Hooker}
 * @constructor
 */
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

    this.isSealed = false;
}


/**
 * Invokes the 'error' callback with the error message
 * @param err {String}   Error message
 * @private
 */
Hooker.prototype._raiseError = function (err) {
    this.invoke(EVENT_ERROR, new Error(err));
}


/**
 * Register hooks
 * @param event {String}    Name with which the hook will be invoked
 * @param opts  {Object}    Options specifying name, priority, timeout
 * @param fn    {Function}  Callback
 */
Hooker.prototype.hook = function (event, opts, fn) {
    if (this.isSealed) {
        this._raiseError('Cannot attach additional hooks on sealed hooker.');
        return;
    }

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

    if (priority < 0 || priority > this._options.maxPriority) {
        this._raiseError('Invalid priority: ' + priority);
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
        debug('registered timeout value');
    }

    this._state[event].push(hookData);
    debug('stored event: ' + event);
}


/**
 * Invokes the callback registered for the hook
 */
Hooker.prototype.invoke = function () {
    if (!this.isSealed) {
        console.warn('warning: implicit seal applied');
        this.seal();
    }

    var args = slice.call(arguments);
    var event = args.shift();
    debug('invoke: ' + event);

    var self = this;

    if (this._state.hasOwnProperty(event)) {
        var targetHooks = this._state[event];

        for (var i = 0, l = targetHooks.length; i < l; i++) {
            var hookData = targetHooks[i];

            if (hookData.waitTimeout) {
                debug('setting timeout for event: ' + event);

                var waitTimer = setTimeout(function waitTimer() {
                    self._raiseError('Timeout waiting for event: ' + event);
                    debug('timeout occurred');
                }, hookData.waitTimeout);

                args.push(function done(err) {
                    if (err) {
                        debug('execution error: ' + err);
                        self.emit(EVENT_ERROR, err);
                    }

                    debug('clearing timeout: ' + event);
                    clearTimeout(waitTimer);
                });
            }

            hookData.callback.apply(self, args);
        }
    } else {
        self._raiseError('Hook not registered: ' + event);
        debug('hook not registered');
    }
}


/**
 * Finalizes the listeners by priority
 */
Hooker.prototype.seal = function () {
    debug('seal');
    var state = this._state;

    if (typeof state !== 'object') {
        this._raiseError('Invalid state');
        return;
    }

    for (var event in state) {
        if (state.hasOwnProperty(event)) {
            state[event].sort(fnSortByPriority);
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