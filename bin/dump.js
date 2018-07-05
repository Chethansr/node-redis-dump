(function() {
  var RedisDumper, redis, run,
    slice = [].slice;

  run = require('async').waterfall;

  redis = require('redis');

  module.exports = function(params, callback) {
    var dumper;
    if (params.port == null) {
      params.port = 6379;
    }
    if (params.host == null) {
      params.host = '127.0.0.1';
    }
    if (params.db == null) {
      params.db = '0';
    }
    if (params.filter == null) {
      params.filter = '*';
    }
    if (params.format == null) {
      params.format = 'redis';
    }
    if (params.convert == null) {
      params.convert = null;
    }
    dumper = new RedisDumper(params);
    return dumper.dump(params, function() {
      var params;
      params = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      dumper.close();
      return callback.apply(null, params);
    });
  };

  RedisDumper = (function() {
    function RedisDumper(arg) {
      var auth, host, port;
      port = arg.port, host = arg.host, auth = arg.auth;
      if (auth != null) {
        this.db = redis.createClient(port, host, {
          auth_pass: auth
        });
      } else {
        this.db = redis.createClient(port, host);
      }
    }

    RedisDumper.prototype.close = function() {
      return this.db.end();
    };

    RedisDumper.prototype.escape = function(value) {
      if (/^([a-zA-Z0-9_\:\-]+)$/.test("" + value)) {
        return "" + value;
      } else {
        return "'" + ("" + value).split('\\').join('\\\\').split('\'').join('\\\'') + "'";
      }
    };

    RedisDumper.prototype.dump = function(arg, callback) {
      var convert, db, e, filter, format, keys, pretty, ttls, types, values;
      db = arg.db, filter = arg.filter, format = arg.format, convert = arg.convert, pretty = arg.pretty;
      keys = [];
      types = [];
      values = [];
      ttls = [];
      if (typeof convert === 'string') {
        try {
          convert = JSON.parse(convert);
        } catch (error) {
          e = error;
          return callback(e);
        }
      }
      this.db.select(db);
      return run([
        (function(_this) {
          return function(next) {
            var k;
            try {
              if (convert != null) {
                return next(null, (function() {
                  var results;
                  results = [];
                  for (k in convert) {
                    results.push(k);
                  }
                  return results;
                })());
              } else {
                return _this.db.keys(filter, next);
              }
            } catch (error) {
              e = error;
              return next(e);
            }
          };
        })(this), (function(_this) {
          return function(reply, next) {
            var k, key, l, len, len1, m, multi, v;
            try {
              for (l = 0, len = reply.length; l < len; l++) {
                key = reply[l];
                keys.push(key);
              }
              if (keys.length === 0) {
                if (format === 'json') {
                  callback(null, '{}');
                } else if (format === 'raw') {
                  callback(null, {});
                } else {
                  callback(null, '');
                }
                next(null, null);
                return;
              }
              keys = keys.sort();
              if (convert != null) {
                return next(null, (function() {
                  var results;
                  results = [];
                  for (k in convert) {
                    v = convert[k];
                    results.push(v.type);
                  }
                  return results;
                })());
              } else {
                multi = _this.db.multi();
                for (m = 0, len1 = keys.length; m < len1; m++) {
                  key = keys[m];
                  multi.type(key);
                }
                return multi.exec(next);
              }
            } catch (error) {
              e = error;
              return next(e);
            }
          };
        })(this), (function(_this) {
          return function(replies, next) {
            var entry, i, l, len, len1, len2, len3, m, multi, n, o, ref, result, type, val;
            try {
              if (keys.length === 0) {
                next(null, null);
                return;
              }
              for (l = 0, len = replies.length; l < len; l++) {
                type = replies[l];
                types.push(type);
              }
              if (convert != null) {
                result = [];
                for (i = m = 0, len1 = types.length; m < len1; i = ++m) {
                  type = types[i];
                  switch (type) {
                    case 'string':
                      result.push(convert[keys[i]].value);
                      break;
                    case 'list':
                      result.push(convert[keys[i]].value);
                      break;
                    case 'set':
                      result.push(convert[keys[i]].value);
                      break;
                    case 'zset':
                      val = [];
                      ref = convert[keys[i]].value;
                      for (n = 0, len2 = ref.length; n < len2; n++) {
                        entry = ref[n];
                        val.push(entry[1]);
                        val.push(entry[0]);
                      }
                      result.push(val);
                      break;
                    case 'hash':
                      result.push(convert[keys[i]].value);
                  }
                }
                return next(null, result);
              } else {
                multi = _this.db.multi();
                for (i = o = 0, len3 = types.length; o < len3; i = ++o) {
                  type = types[i];
                  switch (type) {
                    case 'string':
                      multi.get(keys[i]);
                      break;
                    case 'list':
                      multi.lrange(keys[i], 0, -1);
                      break;
                    case 'set':
                      multi.smembers(keys[i]);
                      break;
                    case 'zset':
                      multi.zrange(keys[i], 0, -1, 'withscores');
                      break;
                    case 'hash':
                      multi.hgetall(keys[i]);
                  }
                }
                return multi.exec(next);
              }
            } catch (error) {
              e = error;
              return next(e);
            }
          };
        })(this), (function(_this) {
          return function(replies, next) {
            var key, l, len, len1, len2, m, multi, n, result, value;
            try {
              if (keys.length === 0) {
                next(null, null);
                return;
              }
              for (l = 0, len = replies.length; l < len; l++) {
                value = replies[l];
                values.push(value);
              }
              if (convert != null) {
                result = [];
                for (m = 0, len1 = keys.length; m < len1; m++) {
                  key = keys[m];
                  if (convert[key].ttl != null) {
                    result.push("" + convert[key].ttl);
                  } else {
                    result.push("-1");
                  }
                }
                return next(null, result);
              } else {
                multi = _this.db.multi();
                for (n = 0, len2 = keys.length; n < len2; n++) {
                  key = keys[n];
                  multi.ttl(key);
                }
                return multi.exec(next);
              }
            } catch (error) {
              e = error;
              return next(e);
            }
          };
        })(this), (function(_this) {
          return function(replies, next) {
            var commands, i, item, j, json, key, l, len, len1, len2, m, n, ttl, type, value;
            try {
              if (keys.length === 0) {
                next(null, null);
                return;
              }
              for (l = 0, len = replies.length; l < len; l++) {
                ttl = replies[l];
                ttls.push(ttl);
              }
              switch (format) {
                case 'json' || 'raw':
                  json = {};
                  for (i = m = 0, len1 = types.length; m < len1; i = ++m) {
                    type = types[i];
                    key = keys[i];
                    value = values[i];
                    switch (type) {
                      case 'string':
                        json[key] = {
                          type: 'string',
                          value: value
                        };
                        break;
                      case 'list':
                        json[key] = {
                          type: 'list',
                          value: value
                        };
                        break;
                      case 'set':
                        json[key] = {
                          type: 'set',
                          value: value.sort()
                        };
                        break;
                      case 'zset':
                        json[key] = {
                          type: 'zset',
                          value: (function() {
                            var len2, n, results;
                            results = [];
                            for (j = n = 0, len2 = value.length; n < len2; j = n += 2) {
                              item = value[j];
                              results.push([parseInt(value[j + 1], 10), value[j]]);
                            }
                            return results;
                          })()
                        };
                        break;
                      case 'hash':
                        json[key] = {
                          type: 'hash',
                          value: value
                        };
                    }
                    ttl = parseInt(ttls[i], 10);
                    if (!isNaN(ttl) && ttl !== -1) {
                      json[key].ttl = ttl;
                    }
                  }
                  if (format === 'json') {
                    if (pretty) {
                      return callback(null, JSON.stringify(json, null, 4));
                    } else {
                      return callback(null, JSON.stringify(json));
                    }
                  } else {
                    return callback(null, json);
                  }
                  break;
                default:
                  commands = [];
                  for (i = n = 0, len2 = types.length; n < len2; i = ++n) {
                    type = types[i];
                    key = /exception:/.test(keys[i]) ? keys[i] : "exception:" + keys[i];
                    value = values[i];
                    switch (type) {
                      case 'string':
                        ttl = parseInt(ttls[i], 10);
                        if (!isNaN(ttl) && ttl !== -1) {
                          commands.push("SET  " + (_this.escape(key)) + " " + (_this.escape(value)) + "  EX  " + ttl);
                        } else {
                          commands.push("SET     " + (_this.escape(key)) + " " + (_this.escape(value)));
                        }
                    }
                  }
                  return callback(null, commands.join("\n"));
              }
            } catch (error) {
              e = error;
              return next(e);
            }
          };
        })(this)
      ], function(err) {
        return callback(err);
      });
    };

    return RedisDumper;

  })();

}).call(this);
