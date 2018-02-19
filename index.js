export default class DeferWork {

  constructor() {
		this.scheduleStart = undefined;
	  this.throttleDelay = undefined;
	  this.lazytimer = undefined;
	  this.lazyraf = undefined;
		this.tasks = [];
	  this.runAttempts = 0;
	  this.isRunning = false;
	  this.remainingTime = 7;
	  this.minThrottle = 35;
	  this.throttle = 125;
	  this.index = 0;
	  this.taskStart = 0;
	  this.tasklength = 0;

		this.root = typeof window != 'undefined' ?
	    window :
	    typeof global !== undefined ?
	    global :
	    this || {};

	  this.IdleDeadline = {
	    get didTimeout() {
	      return false;
	    },
	    timeRemaining: () => {
	      const timeRemaining = this.remainingTime - (Date.now() - this.taskStart);
	      return timeRemaining < 0 ? 0 : timeRemaining;
	    },
	  };

		this.setInactive = this.debounce(() => {
	    this.remainingTime = 22;
	    this.throttle = 66;
	    this.minThrottle = 0;
	  });

    if (!this.root.requestIdleCallback || !this.root.cancelIdleCallback) {
      this.bootShim();
    } else {
      this.bootNative();
    }
  }

  debounce = fn => {
    let id, timestamp;
    const wait = 99;
    const check = () => {
      const last = Date.now() - timestamp;

      if (last < wait) {
        id = window.setTimeout(check, wait - last);
      } else {
        id = null;
        fn();
      }
    }

    return () => {
      timestamp = Date.now();
      if (!id) {
        id = window.setTimeout(check, wait);
      }
    };
  }

  abortRunning = () => {
    if (this.isRunning) {
      if (this.lazyraf) {
        window.cancelAnimationFrame(this.lazyraf);
      }
      if (this.lazytimer) {
        clearTimeout(this.lazytimer);
      }
      this.isRunning = false;
    }
  }

  onInputorMutation = () => {
    if (this.throttle != 125) {
      this.remainingTime = 7;
      this.throttle = 125;
      this.minThrottle = 35;

      if (this.isRunning) {
        this.abortRunning();
        this.scheduleLazy();
      }
    }
    this.setInactive();
  }

  scheduleAfterRaf = () => {
    this.lazyraf = null;
    this.lazytimer = window.setTimeout(this.runTasks, 0);
  }

  scheduleRaf = () => {
    this.lazytimer = null;
    window.requestAnimationFrame(this.scheduleAfterRaf);
  }

  scheduleLazy = () => {

    if (this.isRunning) {
      return;
    }
    const now = Date.now();
    this.throttleDelay = this.throttle - (now - this.taskStart);

    this.scheduleStart = now;

    this.isRunning = true;

    if (this.minThrottle && this.throttleDelay < this.minThrottle) {
      this.throttleDelay = this.minThrottle;
    }

    if (this.throttleDelay > 9) {
      this.lazytimer = window.setTimeout(this.scheduleRaf, this.throttleDelay);
    } else {
      this.throttleDelay = 0;
      this.scheduleRaf();
    }
  }

  runTasks = () => {
    let task, i;
    const timeThreshold = this.remainingTime > 9 ? 9 : 1;
		const remainingTasks = this.tasks.length;

    this.taskStart = Date.now();
    this.isRunning = false;
    this.lazytimer = null;

    if (++this.runAttempts > 2 || this.taskStart - this.throttleDelay - 50 < this.scheduleStart) {
			for (i = 0; i < remainingTasks && this.IdleDeadline.timeRemaining() > timeThreshold; i++) {
        task = this.tasks.shift();
        this.tasklength++;
        if (task) {
          task(this.IdleDeadline);
        }
      }
    }

    if (remainingTasks) {
			this.scheduleLazy();
    } else {
			this.runAttempts = 0;
    }
  }

  requestIdleCallbackShim = task => {
    this.index++;
    this.tasks.push(task);
    this.scheduleLazy();
    return this.index;
  }

  cancelIdleCallbackShim = id => {
    const index = id - 1 - this.tasklength;
    if (this.tasks[index]) {
      this.tasks[index] = null;
    }
  }

  bootShim = () => {
    this.requestIdleCallback = this.requestIdleCallbackShim;
    this.cancelIdleCallback = this.cancelIdleCallbackShim;

    if (this.root.document && document.addEventListener) {
      this.root.addEventListener('scroll', this.onInputorMutation, true);
      this.root.addEventListener('resize', this.onInputorMutation);

      document.addEventListener('focus', this.onInputorMutation, true);
      document.addEventListener('mouseover', this.onInputorMutation, true);
      ['click', 'keypress', 'touchstart', 'mousedown'].forEach(function(name) {
        document.addEventListener(name, this.onInputorMutation, {
          capture: true,
          passive: true
        });
      });

      if (this.root.MutationObserver) {
        new MutationObserver(this.onInputorMutation).observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true
        });
      }
    }
  }

  bootNative = () => {
    try {
      this.requestIdleCallback = window.requestIdleCallback;
      this.requestIdleCallback(() => {}, {
        timeout: 0
      });
    } catch (e) {
      (root => {
        let timeRemainingProto, timeRemaining;
        this.requestIdleCallback = (fn, timeout) => {
          if (timeout && typeof timeout.timeout == 'number') {
            return root.requestIdleCallback(fn, timeout.timeout);
          }
          return root.requestIdleCallback(fn);
        };

        if (root.IdleCallbackDeadline && (timeRemainingProto = root.IdleCallbackDeadline.prototype)) {
          timeRemaining = Object.getOwnPropertyDescriptor(timeRemainingProto, 'timeRemaining');

          if (!timeRemaining || !timeRemaining.configurable || !timeRemaining.get) {
            return;
          }

          Object.defineProperty(timeRemainingProto, 'timeRemaining', {
            value: function() {
              return timeRemaining.get.call(this);
            },
            enumerable: true,
            configurable: true,
          });
        }
      })(this.root)
    }
  }
}
