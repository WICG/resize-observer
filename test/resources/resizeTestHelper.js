'use strict';

/**
 ResizeTestHelper is a framework to test ResizeObserver
 notifications. Use it to make assertions about ResizeObserverEntries.

 It handles timeouts, and queueing of multiple steps in a test.

*/
function ResizeTestHelper() {
  this._pendingTests = [];
  this._observer = new ResizeObserver(this._handleNotification.bind(this));
}

ResizeTestHelper.prototype = {

  TIMEOUT: 2000,

  // @return ResizeObserver
  get observer() {
    return this._observer;
  },

  _handleNotification: function(entries) {
    if (this._currentTest) {
      // console.log("notification");
      let current = this._currentTest;
      delete this._currentTest;
      window.clearTimeout(current.timeoutId);
      current.test.step(_ => {
        // console.log("step");
        let caughtEx = false;
        try {
          current.completion(entries);
          current.test.done();
        }
        catch(ex) {
          caughtEx = ex;
        }
        if (caughtEx)
          throw caughtEx;
      });
    }
  },
  _handleTimeout: function() {
    if (this._currentTest) {
      let current  = this._currentTest;
      delete this._currentTest;
      if (current.timeout) { // timeout is not an error
        current.timeout();
        current.test.done();
      }
      else {
        current.test.step(_ => {
          assert_unreached("Timed out waiting for notification. (" + this.TIMEOUT + "ms)");
          current.test.done();
        });
      }
    }
  },

  /*
  Kicks off tests. Processes all the tests in order, until
  _pendingTests is empty
  */
  nextTest: function() {
    if (this._currentTest) // only one test at a time
      return;
    if (this._pendingTests.length > 0) {
      this._currentTest = this._pendingTests.shift();
      // console.log("executing ", this._currentTest.name);
      this._currentTest.setup();
      this._currentTest.timeoutId = this._currentTest.test.step_timeout(this._handleTimeout.bind(this), this.TIMEOUT);
    }
  },

  nextTestRaf: function() {
    window.requestAnimationFrame( () => this.nextTest() );
  },

  /**
  Adds new test to _pendingTests.
   */
  createTest: function(name, setup, completion, timeoutCb) {
    // console.log('setup ', name);
    this._pendingTests.push( {
      name: name,
      test: async_test(name),
      setup: setup,
      completion: completion,
      timeout: timeoutCb });
  }

}
