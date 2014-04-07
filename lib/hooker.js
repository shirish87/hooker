var debug = require('debug')('hooker');

'use strict';

/**
 * Default options
 */
var DEF_PRIORITY = 5;

var DEF_OPTIONS = {
    maxPriority: 20
  , timeout: -1
  , allowUnregHooks: true
};



/**
 * Cache
 */
var slice = Array.prototype.slice;




/**
 * Creates a new hooker
 * @param options {*}         Options that override defaults: maxPriority
 * @param callback {Function} Callback to be executed on completion or error
 * @returns {Hooker}
 * @constructor
 */
function Hooker(options, callback) {
    // allow initialization without a new prefix
    if (!(this instanceof Hooker)) {
        return new Hooker(options, callback);
    }

    if (!callback && typeof options === 'function') {
        callback = options;
        options = null;
    }

    options = options || {};

    for (var key in DEF_OPTIONS) {
        if (DEF_OPTIONS.hasOwnProperty(key) && typeof options[key] === 'undefined') {
            options[key] = DEF_OPTIONS[key];
        }
    }

    this._options = options;
    this._callback = callback || function (err) {
        if (err) {
            debug('error: ' + err);
        } else {
            debug('complete');
        }
    };

    this._state = {};
    this._timeout = null;

    this.isSealed = false;

    return this;
}


/**
 * Starts global execution timeout
 * @private
 */
Hooker.prototype._startTimeout = function () {
    if (!this._timeout) {
        var self = this;

        setTimeout(function () {
            self._raiseError('global timeout occurred');
        }, this._options.timeout);

        debug('set global timeout');
    }
};


/**
 * Clears global execution timeout
 * @private
 */
Hooker.prototype._clearTimeout = function () {
    if (this._timeout) {
        clearTimeout(this._timeout);
        debug('cleared global timeout');
    }
};


/**
 * Notifies callback of error
 * @param err {String}   Error message
 * @private
 */
Hooker.prototype._raiseError = function (err) {
    this._clearTimeout();

    if (this._callback) {
        this._callback(new Error(err));
        this._callback = null;
    }
};


/**
 * Checks and notifies callback if all hooks have been executed
 * @private
 */
Hooker.prototype._checkComplete = function () {
    if (this.isDone()) {
        this._clearTimeout();

        if (this._callback) {
            this._callback();
            this._callback = null;
        }
    }
};


/**
 * Determines whether all hooks have executed
 * @returns {boolean}
 */
Hooker.prototype.isDone = function () {
    var isDone = true;

    this._browseHooks(function (err, hookData) {
        if (hookData && !hookData.isDone) {
            isDone = false;

            // stop browsing hooks
            return false;
        }

        // continue browsing hooks
        return true;
    });

    return isDone;
};


/**
 * Register hooks
 * @param event {String}       Name with which the hook will be invoked
 * @param opts  {*}            Options specifying name, priority, timeout
 * @param callback {Function}  Callback
 */
Hooker.prototype.hook = function (event, opts, callback) {
    if (this.isSealed) {
        this._raiseError('Cannot attach additional hooks on sealed hooker.');
        return;
    }

    if (typeof event !== 'string' || !event.length) {
        this._raiseError('Invalid event: ' + event);
        return;
    }

    // function (event, callback)
    if (!callback && typeof opts === 'function') {
        callback = opts;
        opts = {};
    }

    if (typeof callback !== 'function') {
        this._raiseError('Expected callback to be a function');
        return;
    }

    var name
      , timeout
      , priority
      , track
      , hookData
      ;

    name = (typeof opts.name === 'string')
        ? opts.name
        : '';

    timeout = (typeof opts.timeout === 'number')
        ? opts.timeout
        : 0;

    priority = (typeof opts.priority === 'number')
        ? opts.priority
        : DEF_PRIORITY;

    track = (typeof opts.track === 'boolean')
        ? opts.track
        : false;

    if (priority < 0 || priority > this._options.maxPriority) {
        this._raiseError('Invalid priority: ' + priority);
        return;
    }


    if (!this._state.hasOwnProperty(event)) {
        this._state[event] = [];
        debug('creating new event: ' + event);
    }

    hookData = {
        event: event
      , priority: priority
      , name: name
      , isDone: false
      , callback: callback
    };

    if (timeout > 0) {
        hookData.waitTimeout = timeout;
        debug('registered timeout');
    } else if (track) {
        hookData.track = true;
        debug('registered for tracking');
    }

    this._state[event].push(hookData);
    debug('stored event: ' + event);
};



/**
 * Returns a function that should be called in the hook-callback
 * to denote completion of work.
 * @param hookData
 * @returns {function}
 * @private
 */
Hooker.prototype._createTrackCallback = function (hookData) {
    debug('set tracking for event: ' + hookData.event);

    var self = this;

    return function done(err) {
        if (err) {
            debug('execution error: ' + err);
            self._raiseError(err);
        }

        hookData.isDone = true;
        debug('clear tracking for: ' + hookData.event);
    }
};



/**
 * Returns a function that should be called in the hook-callback
 * to denote completion of work.
 * Also creates a timer to track execution of work.
 * @param hookData
 * @returns {function}
 * @private
 */
Hooker.prototype._createWaitCallback = function (hookData) {
    debug('set timeout for event: ' + hookData.event);

    var self = this
      , waitTimer
      ;

    waitTimer = setTimeout(function waitTimer() {
        if (!hookData.isDone) {
            self._raiseError('Timeout waiting for event: ' + hookData.event);
            debug('timeout: ' + hookData.event);
        }
    }, hookData.waitTimeout);


    return function done(err) {
        if (err) {
            debug('execution error: ' + err);
            self._raiseError(err);
        }

        clearTimeout(waitTimer);
        hookData.isDone = true;
        debug('clear timeout: ' + hookData.event);
    }
};





Hooker.prototype._browseHooks = function (event, callback) {
    var state;

    if (typeof event === 'function') {
        callback = event;
        event = null;
    }

    if (event) {
        if (!this._state.hasOwnProperty(event)) {
            callback(new Error('unknown event: ' + event));
            return;
        }

        // filter to browse a particular event
        state = {};
        state[event] = this._state[event];
    } else {
        state = this._state;
    }

    for (var ev in state) {
        if (state.hasOwnProperty(ev)) {
            var hooks = state[ev];

            for (var i = 0, l = hooks.length; i < l; i++) {
                if (!callback(null, hooks[i], ev, i, l)) {
                    return;
                }
            }
        }
    }
};


/**
 * Iterates through hooks registered for the specified event(s)
 * callback is called for each hook of matched event(s)
 * @param events
 * @param callback
 */
Hooker.prototype.walk = function (events, callback) {
    if (!this.isSealed) {
        console.warn('warning: implicit seal applied');
        this.seal();
    }

    if (typeof events === 'string') {
        events = [ events ];
    } else if (!Array.isArray(events)) {
        callback(new Error('Invalid argument: ' + typeof events));
        return;
    }

    var self = this;

    events.forEach(function (event) {
        self._browseHooks(event, callback);
    })
};


/**
 * Invokes the callback registered for the hook
 */
Hooker.prototype.invoke = function () {
    if (!this.isSealed) {
        console.warn('warning: implicit seal applied');
        this.seal();
    }

    var args = slice.call(arguments)
      , event = args.shift()
      , self = this
      ;

    if (typeof event !== 'string' || !event.length) {
        debug('invoke: undefined event');
        return;
    }

    debug('invoke: ' + event);

    this._browseHooks(event, function (err, hookData) {
        if (err) {
            debug('no hooks registered for event: ' + event);

            if (!self._options.allowUnregHooks) {
                self._raiseError('No hooks registered for event: ' + event);
            }

            // stop browsing hooks
            return false;
        }

        if (hookData.isDone) {
            // skip, since this has already been completed
            return true;
        }

        var isTracked = false;

        if (hookData.waitTimeout) {
            args.push(self._createWaitCallback(hookData));
            isTracked = true;
        } else if (hookData.track) {
            args.push(self._createTrackCallback(hookData));
            isTracked = true;
        }

        // synchronous call
        debug('executing callback');
        hookData.callback.apply(self, args);

        if (!isTracked) {
            hookData.isDone = true;
        }

        self._checkComplete();

        // continue browsing hooks
        return true;
    });
};



function fnSortByPriority(a, b) {
    return a.priority - b.priority;
}



/**
 * Finalizes the hooks by priority
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

    if (this._options.timeout > 0) {
        this._startTimeout();
    }

    this.isSealed = true;
};




/*!
 * Module exports.
 */
module.exports = exports = Hooker;