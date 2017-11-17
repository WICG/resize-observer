(function(global) {
  // return when feature is supported natively
  if('ResizeObserver' in global) {
    return;
  }

  var POLL_INTERVAL = 100;

  // Constructor
  var ResizeObserver = function(callback) {
    // error when callback is not a function
    if(typeof callback !== 'function') {
      throw('callback needs to be a function');
    }

    this._callback = callback;
    this._frame = null;
    this._init();
  };

  ResizeObserver.prototype = {
    // Public API
    observe: function(target) {
      // target must be an HTMLElement
      if (!(target instanceof HTMLElement)) {
        throw('Target needs to be an HTMLelement');
      }

      // bail out when already observing target
      if (this._containsTarget(target)) {
        return;
      }

      var rects = getBoundingClientRect(target)

      this._observationEntries.push({
        target: target,
        height: rects.height,
        width: rects.width
      });

      rects = null;
    },

    unobserve: function(target) {
      this._observationEntries = this._observationEntries.filter(function(entry) {
        return entry.target !== target;
      });
    },

    disconnect: function() {
      global.cancelAnimationFrame(this._frame);
      this._observationEntries = [];
      this._descheduleCallback();
    },

    // Private API
    _init: function() {
      this._observationEntries = [];
      this._queue = [];
      this._compare();
    },

    _compare: function() {
      this._observationEntries.forEach(function(entry) {
        if (!hasChanged(entry)) {
          return;
        }

        var resizeEntry = {
          target: entry.target,
          height: entry.height,
          width: entry.width
        }

        Object.freeze(resizeEntry);

        this._queue.push(resizeEntry);
        this._scheduleCallback();
      }.bind(this));

      this._frame = global.requestAnimationFrame(this._compare.bind(this));
    },

    _containsTarget: function(target) {
      var flag = false;

      this._observationEntries.forEach(function(entry) {
        if (entry.target === target)
          flag = true;
      });

      return flag;
    },

    _scheduleCallback: function() {
      if(this._timeoutId) {
        return;
      }

      this._timeoutId = global.setTimeout(function() {
        this._descheduleCallback();
        this._callback(this._queue, this);
        this._queue = [];
      }.bind(this), POLL_INTERVAL);
    },

    _descheduleCallback: function() {
      if(!this._timeoutId) {
        return;
      }

      global.clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  };

  // helpers
  var hasChanged = function(entry) {
    var current = getBoundingClientRect(entry.target);

    if (current.height !== entry.height || current.width !== entry.width) {
      entry.height = current.height;
      entry.width = current.width;
      return true;
    }

    return false;
  }

  var getBoundingClientRect = function(el) {
    var r = el.getBoundingClientRect();

    if (!r) {
      return null;
    }
    // Older IE
    r.width = r.width || r.right - r.left;
    r.height = r.height || r.bottom - r.top;
    return r;
  };

  global.ResizeObserver = ResizeObserver;
})(window);
