// Hungarian translation provided by =Krumpli=

ScriptAPI.register('FarmGod', true, 'Warre', 'nl.tribalwars@coma.innogames.de');

window.FarmGod = {};
window.FarmGod.Library = (function () {
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () {
        if (this.queues === null) {
          this.queues = this.queueLib.createQueues(5);
        }
      },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) {
          this.action = action;
          this.arguments = arg;
          this.promise = promise;
          this.attempts = 0;
        },
        Queue: function () {
          this.list = [];
          this.working = false;
          this.length = 0;

          this.doNext = function () {
            let item = this.dequeue();
            let self = this;

            if (item.action == 'openWindow') {
              window
                .open(...item.arguments)
                .addEventListener(
                  'DOMContentLoaded',
                  function () {
                    self.start();
                  }
                );
            } else {
              $[item.action](...item.arguments)
                .done(function () {
                  item.promise.resolve.apply(null, arguments);
                  self.start();
                })
                .fail(function () {
                  item.attempts += 1;
                  if (
                    item.attempts <
                    twLib.queueLib.maxAttempts
                  ) {
                    self.enqueue(item, true);
                  } else {
                    item.promise.reject.apply(
                      null,
                      arguments
                    );
                  }

                  self.start();
                });
            }
          };

          this.start = function () {
            if (this.length) {
              this.working = true;
              this.doNext();
            } else {
              this.working = false;
            }
          };

          this.dequeue = function () {
            this.length -= 1;
            return this.list.shift();
          };

          this.enqueue = function (item, front = false) {
            front ? this.list.unshift(item) : this.list.push(item);
            this.length += 1;

            if (!this.working) {
              this.start();
            }
          };
        },
        createQueues: function (amount) {
          let arr = [];
          for (let i = 0; i < amount; i++) {
            arr[i] = new twLib.queueLib.Queue();
          }
          return arr;
        },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues
            .map((q) => q.length)
            .reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) {
          let promise = $.Deferred();
          let item = new twLib.queueLib.Item(type, arg, promise);
          twLib.queueLib.addItem(item);
          return promise;
        },
      },
      ajax: function () {
        return twLib.queueLib.orchestrator('ajax', arguments);
      },
      get: function () {
        return twLib.queueLib.orchestrator('get', arguments);
      },
      post: function () {
        return twLib.queueLib.orchestrator('post', arguments);
      },
      openWindow: function () {
        let item = new twLib.queueLib.Item('openWindow', arguments);
        twLib.queueLib.addItem(item);
      },
    };
    twLib.init();
  }

  const setUnitSpeeds = function () {
    let unitSpeeds = {};
    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml)
        .find('config')
        .children()
        .map((i, el) => {
          unitSpeeds[$(el).prop('nodeName')] = $(el)
            .find('speed')
            .text()
            .toNumber();
        });

      localStorage.setItem(
        'FarmGod_unitSpeeds',
        JSON.stringify(unitSpeeds)
      );
    });
  };

  const getUnitSpeeds = function () {
    return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false;
  };

  if (!getUnitSpeeds()) setUnitSpeeds();

  const getDistance = function (origin, target) {
    let a = origin.toCoord(true).x - target.toCoord(true).x;
    let b = origin.toCoord(true).y - target.toCoord(true).y;
    return Math.hypot(a, b);
  };

  const subtractArrays = function (array1, array2) {
    let result = array1.map((val, i) => {
      return val - array2[i];
    });
    return result.some((v) => v < 0) ? false : result;
  };

  const getCurrentServerTime = function () {
    let [hour, min, sec, day, month, year] = $('#serverTime')
      .closest('p')
      .text()
      .match(/\d+/g);
    return new Date(year, month - 1, day, hour, min, sec).getTime();
  };

  String.prototype.toCoord = function (objectified) {
    let c = (this.match(/\d{1,3}\|\d{1,3}/g) || [false]).pop();
    return c && objectified
      ? { x: c.split('|')[0], y: c.split('|')[1] }
      : c;
  };

  String.prototype.toNumber = function () {
    return parseFloat(this);
  };

  Number.prototype.toNumber = function () {
    return parseFloat(this);
  };

  return {
    getUnitSpeeds,
    getDistance,
    subtractArrays,
    getCurrentServerTime,
  };
})();

window.FarmGod.Main = (function (Library) {
  const lib = Library;
  let curVillage = null;
  let farmBusy = false;

  const init = function () {
    if (game_data.screen == 'am_farm') {
      $('.farmGodContent').remove();
      $('#am_widget_Farm').first().before(buildTable({}));
      bindEventHandlers();
    } else {
      location.href = game_data.link_base_pure + 'am_farm';
    }
  };

  const bindEventHandlers = function () {
    $('.farmGod_icon')
      .off('click')
      .on('click', function () {
        sendFarm($(this));
      });

    // ENTER spam PC
    $(document)
      .off('keydown')
      .on('keydown', (event) => {
        if ((event.keyCode || event.which) == 13) {
          $('.farmGod_icon').first().trigger('click');
        }
      });

    // ===== MOBILE HOLD SEND =====
    let holdInterval = null;

    $(document)
      .off('touchstart', '#farmGodSendBtn')
      .on('touchstart', '#farmGodSendBtn', function (e) {
        e.preventDefault();
        if (holdInterval) return;

        holdInterval = setInterval(() => {
          let $next = $('.farmGod_icon').first();
          if ($next.length) {
            $next.trigger('click');
          } else {
            clearInterval(holdInterval);
            holdInterval = null;
          }
        }, 250);
      });

    $(document)
      .off('touchend touchcancel', '#farmGodSendBtn')
      .on('touchend touchcancel', '#farmGodSendBtn', function () {
        if (holdInterval) {
          clearInterval(holdInterval);
          holdInterval = null;
        }
      });
  };

  const buildTable = function (plan) {
    let isMobile = $('#mobileHeader').length > 0;

    let mobileSendBtn = isMobile
      ? `<tr>
          <td colspan="4" style="text-align:center;padding:6px;">
            <button id="farmGodSendBtn" class="btn"
              style="width:100%;font-size:18px;height:40px;">
              SEND
            </button>
          </td>
        </tr>`
      : ``;

    let html = `<div class="vis farmGodContent">
                <h4>FarmGod</h4>
                <table class="vis" width="100%">
                ${mobileSendBtn}
                <tr>
                  <th style="text-align:center;">Origin</th>
                  <th style="text-align:center;">Target</th>
                  <th style="text-align:center;">Fields</th>
                  <th style="text-align:center;">Farm</th>
                </tr>
                <tr class="farmRow">
                  <td style="text-align:center;">Village</td>
                  <td style="text-align:center;">000|000</td>
                  <td style="text-align:center;">0</td>
                  <td style="text-align:center;">
                    <a href="#" data-origin="0" data-target="0" data-template="0"
                    class="farmGod_icon farm_icon farm_icon_a"></a>
                  </td>
                </tr>
                </table></div>`;

    return html;
  };

  const sendFarm = function ($this) {
    let n = Timing.getElapsedTimeSinceLoad();
    if (
      !farmBusy &&
      !(
        Accountmanager.farm.last_click &&
        n - Accountmanager.farm.last_click < 200
      )
    ) {
      farmBusy = true;
      Accountmanager.farm.last_click = n;

      TribalWars.post(
        Accountmanager.send_units_link.replace(
          /village=(\d+)/,
          'village=' + $this.data('origin')
        ),
        null,
        {
          target: $this.data('target'),
          template_id: $this.data('template'),
          source: $this.data('origin'),
        },
        function () {
          $this.closest('.farmRow').remove();
          farmBusy = false;
        },
        function () {
          $this.closest('.farmRow').remove();
          farmBusy = false;
        }
      );
    }
  };

  return { init };
})(window.FarmGod.Library);

(() => {
  window.FarmGod.Main.init();
})();
