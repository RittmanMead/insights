(function() {
  var callWithJQuery,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    slice = [].slice,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    hasProp = {}.hasOwnProperty;

  callWithJQuery = function(pivotModule) {
    if (typeof exports === "object" && typeof module === "object") {
      return pivotModule(require("jquery"));
    } else if (typeof define === "function" && define.amd) {
      return define(["jquery"], pivotModule);
    } else {
      return pivotModule(jQuery);
    }
  };

  callWithJQuery(function($) {

    /* Utilities */
    var PivotData, addSeparators, aggregatorTemplates, aggregators, dayNamesEn, derivers, getSort, locales, mthNamesEn, naturalSort, numberFormat, pivotTableRenderer, renderers, sortAs, usFmt, usFmtInt, usFmtPct, zeroPad;
    addSeparators = function(nStr, thousandsSep, decimalSep) {
      var rgx, x, x1, x2;
      nStr += '';
      x = nStr.split('.');
      x1 = x[0];
      x2 = x.length > 1 ? decimalSep + x[1] : '';
      rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + thousandsSep + '$2');
      }
      return x1 + x2;
    };
    numberFormat = function(opts) {
      var defaults;
      defaults = {
        digitsAfterDecimal: 2,
        scaler: 1,
        thousandsSep: ",",
        decimalSep: ".",
        prefix: "",
        suffix: "",
        showZero: false
      };
      opts = $.extend(defaults, opts);
      return function(x) {
        var result;
        if (isNaN(x) || !isFinite(x)) {
          return "";
        }
        if (x === 0 && !opts.showZero) {
          return "";
        }
        result = addSeparators((opts.scaler * x).toFixed(opts.digitsAfterDecimal), opts.thousandsSep, opts.decimalSep);
        return "" + opts.prefix + result + opts.suffix;
      };
    };
    usFmt = numberFormat();
    usFmtInt = numberFormat({
      digitsAfterDecimal: 0
    });
    usFmtPct = numberFormat({
      digitsAfterDecimal: 1,
      scaler: 100,
      suffix: "%"
    });
    aggregatorTemplates = {
      count: function(formatter) {
        if (formatter == null) {
          formatter = usFmtInt;
        }
        return function() {
          return function(data, rowKey, colKey) {
            return {
              count: 0,
              push: function() {
                return this.count++;
              },
              value: function() {
                return this.count;
              },
              format: formatter
            };
          };
        };
      },
      countUnique: function(formatter) {
        if (formatter == null) {
          formatter = usFmtInt;
        }
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              uniq: [],
              push: function(record) {
                var ref;
                if (ref = record[attr], indexOf.call(this.uniq, ref) < 0) {
                  return this.uniq.push(record[attr]);
                }
              },
              value: function() {
                return this.uniq.length;
              },
              format: formatter,
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
      listUnique: function(sep) {
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              uniq: [],
              push: function(record) {
                var ref;
                if (ref = record[attr], indexOf.call(this.uniq, ref) < 0) {
                  return this.uniq.push(record[attr]);
                }
              },
              value: function() {
                return this.uniq.join(sep);
              },
              format: function(x) {
                return x;
              },
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
      sum: function(formatter) {
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              sum: 0,
              push: function(record, idx) {
                if (!isNaN(parseFloat(record[attr]))) {
                  return this.sum += parseFloat(record[attr]);
                }
              },
              value: function() {
                return this.sum;
              },
              format: formatter,
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
      min: function(formatter) {
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              val: null,
              push: function(record) {
                var ref, x;
                x = parseFloat(record[attr]);
                if (!isNaN(x)) {
                  return this.val = Math.min(x, (ref = this.val) != null ? ref : x);
                }
              },
              value: function() {
                return this.val;
              },
              format: formatter,
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
      max: function(formatter) {
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              val: null,
              push: function(record) {
                var ref, x;
                x = parseFloat(record[attr]);
                if (!isNaN(x)) {
                  return this.val = Math.max(x, (ref = this.val) != null ? ref : x);
                }
              },
              value: function() {
                return this.val;
              },
              format: formatter,
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
      average: function(formatter) {
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
          var attr;
          attr = arg;
          return function(data, rowKey, colKey) {
            return {
              sum: 0,
              len: 0,
              push: function(record) {
                if (!isNaN(parseFloat(record[attr]))) {
                  this.sum += parseFloat(record[attr]);
                  return this.len++;
                }
              },
              value: function() {
                return this.sum / this.len;
              },
              format: formatter,
              numInputs: attr != null ? 0 : 1
            };
          };
        };
      },
	  // RM Customisation: Median aggregator
	  median: function(formatter) {
		if (formatter == null) {
			formatter = usFmt;
        }
		return function(arg) {
			var attr;
			attr = arg;
			return function(data, rowKey, colKey) {
				return {
					len: 0,
					values: [],
					push: function(record) {
						this.values.push(record[attr]);
						return this.len++;
					},
					value: function() {
						this.values.sort();
						return this.values[Math.floor(this.len/2)];
					},
					format: formatter,
					numInputs: attr != null ? 0 : 1
				};
			};
		};
	  },
      sumOverSum: function(formatter) {
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
		  var denom, num;
          num = arg[0], denom = arg[1];
          return function(data, rowKey, colKey) {
            return {
              sumNum: 0,
              sumDenom: 0,
              push: function(record) {
                if (!isNaN(parseFloat(record[num]))) {
                  this.sumNum += parseFloat(record[num]);
                }
                if (!isNaN(parseFloat(record[denom]))) {
                  return this.sumDenom += parseFloat(record[denom]);
                }
              },
              value: function() {
                return this.sumNum / this.sumDenom;
              },
              format: formatter,
              numInputs: (num != null) && (denom != null) ? 0 : 2
            };
          };
        };
      },
      sumOverSumBound80: function(upper, formatter) {
        if (upper == null) {
          upper = true;
        }
        if (formatter == null) {
          formatter = usFmt;
        }
        return function(arg) {
          var denom, num;
          num = arg[0], denom = arg[1];
          return function(data, rowKey, colKey) {
            return {
              sumNum: 0,
              sumDenom: 0,
              push: function(record) {
                if (!isNaN(parseFloat(record[num]))) {
                  this.sumNum += parseFloat(record[num]);
                }
                if (!isNaN(parseFloat(record[denom]))) {
                  return this.sumDenom += parseFloat(record[denom]);
                }
              },
              value: function() {
                var sign;
                sign = upper ? 1 : -1;
                return (0.821187207574908 / this.sumDenom + this.sumNum / this.sumDenom + 1.2815515655446004 * sign * Math.sqrt(0.410593603787454 / (this.sumDenom * this.sumDenom) + (this.sumNum * (1 - this.sumNum / this.sumDenom)) / (this.sumDenom * this.sumDenom))) / (1 + 1.642374415149816 / this.sumDenom);
              },
              format: formatter,
              numInputs: (num != null) && (denom != null) ? 0 : 2
            };
          };
        };
      },
      fractionOf: function(wrapped, type, formatter) {
        if (type == null) {
          type = "total";
        }
        if (formatter == null) {
          formatter = usFmtPct;
        }
        return function(arg) {
          var x;
          x = 1 <= arguments.length ? slice.call(arguments, 0) : [];
          return function(data, rowKey, colKey) {
            return {
              selector: {
                total: [[], []],
                row: [rowKey, []],
                col: [[], colKey]
              }[type],
              inner: wrapped.apply(null, x)(data, rowKey, colKey),
              push: function(record) {
                return this.inner.push(record);
              },
              format: formatter,
              value: function() {
				var idx = $.inArray(arg, data.valAttrs);
				this.selector.push(idx);
                return this.inner.value() / data.getAggregator.apply(data, this.selector).inner.value();
              },
              numInputs: wrapped.apply(null, x)().numInputs
            };
          };
        };
      }
    };
    aggregators = (function(tpl) {
      return {
        "Count": tpl.count(usFmtInt),
        "Count Unique Values": tpl.countUnique(usFmtInt),
        "List Unique Values": tpl.listUnique(", "),
        "Sum": tpl.sum(usFmt),
        "Integer Sum": tpl.sum(usFmtInt),
        "Mean": tpl.average(usFmt),
		"Median": tpl.median(usFmt),
        "Minimum": tpl.min(usFmt),
        "Maximum": tpl.max(usFmt),
        "Sum as % of Total": tpl.fractionOf(tpl.sum(), "total", usFmtPct),
        "Sum as % of Rows": tpl.fractionOf(tpl.sum(), "row", usFmtPct),
        "Sum as % of Columns": tpl.fractionOf(tpl.sum(), "col", usFmtPct),
        "Count as % of Total": tpl.fractionOf(tpl.count(), "total", usFmtPct),
        "Count as % of Rows": tpl.fractionOf(tpl.count(), "row", usFmtPct),
        "Count as % of Columns": tpl.fractionOf(tpl.count(), "col", usFmtPct)
      };
    })(aggregatorTemplates);
    renderers = {
	  "Table": function(pvtData, opts) {
        return $(pivotTableRenderer(pvtData, opts)).pivotTheme(opts.colour, opts.condFormats, opts.rawData).callback(pvtData);
      },
      "Table Barchart": function(pvtData, opts) {
        return $(pivotTableRenderer(pvtData, opts)).barchart(opts.colour, opts.condFormats, opts.rawData, pvtData, opts).callback(pvtData);
      }
    };
    locales = {
      en: {
        aggregators: aggregators,
        renderers: renderers,
        localeStrings: {
          renderError: "An error occurred rendering the PivotTable results.",
          computeError: "An error occurred computing the PivotTable results.",
          uiRenderError: "An error occurred rendering the PivotTable UI.",
          selectAll: "Select All",
          selectNone: "Select None",
          tooMany: "(too many to list)",
          filterResults: "Filter results",
          totals: "Totals",
          vs: "vs",
          by: "by"
        }
      }
    };
    mthNamesEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    zeroPad = function(number) {
      return ("0" + number).substr(-2, 2);
    };
    derivers = {
      bin: function(col, binWidth) {
        return function(record) {
          return record[col] - record[col] % binWidth;
        };
      },
      dateFormat: function(col, formatString, utcOutput, mthNames, dayNames) {
        var utc;
        if (utcOutput == null) {
          utcOutput = false;
        }
        if (mthNames == null) {
          mthNames = mthNamesEn;
        }
        if (dayNames == null) {
          dayNames = dayNamesEn;
        }
        utc = utcOutput ? "UTC" : "";
        return function(record) {
          var date;
          date = new Date(Date.parse(record[col]));
          if (isNaN(date)) {
            return "";
          }
          return formatString.replace(/%(.)/g, function(m, p) {
            switch (p) {
              case "y":
                return date["get" + utc + "FullYear"]();
              case "m":
                return zeroPad(date["get" + utc + "Month"]() + 1);
              case "n":
                return mthNames[date["get" + utc + "Month"]()];
              case "d":
                return zeroPad(date["get" + utc + "Date"]());
              case "w":
                return dayNames[date["get" + utc + "Day"]()];
              case "x":
                return date["get" + utc + "Day"]();
              case "H":
                return zeroPad(date["get" + utc + "Hours"]());
              case "M":
                return zeroPad(date["get" + utc + "Minutes"]());
              case "S":
                return zeroPad(date["get" + utc + "Seconds"]());
              default:
                return "%" + p;
            }
          });
        };
      }
    };
    naturalSort = (function(_this) {
      return function(as, bs) {
        var a, a1, b, b1, rd, rx, rz;
        rx = /(\d+)|(\D+)/g;
        rd = /\d/;
        rz = /^0/;
        if (typeof as === "number" || typeof bs === "number") {
          if (isNaN(as)) {
            return 1;
          }
          if (isNaN(bs)) {
            return -1;
          }
          return as - bs;
        }
        a = String(as).toLowerCase();
        b = String(bs).toLowerCase();
        if (a === b) {
          return 0;
        }
        if (!(rd.test(a) && rd.test(b))) {
          return (a > b ? 1 : -1);
        }
        a = a.match(rx);
        b = b.match(rx);
        while (a.length && b.length) {
          a1 = a.shift();
          b1 = b.shift();
          if (a1 !== b1) {
            if (rd.test(a1) && rd.test(b1)) {
              return a1.replace(rz, ".0") - b1.replace(rz, ".0");
            } else {
              return (a1 > b1 ? 1 : -1);
            }
          }
        }
        return a.length - b.length;
      };
    })(this);

	// Sort function for value labels based on ordering index rather than alphabetical
	valueSort = (function(_this) {
		return function(as, bs) {
			var aidx, bidx;
			aidx = $.inArray(as, _this.valAttrs);
			bidx = $.inArray(bs, _this.valAttrs);

			return aidx - bidx;
		};
	})(this);

    sortAs = function(order) {
      var i, mapping, x;
      mapping = {};
      for (i in order) {
        x = order[i];
        mapping[x] = i;
      }
      return function(a, b) {
        if ((mapping[a] != null) && (mapping[b] != null)) {
          return mapping[a] - mapping[b];
        } else if (mapping[a] != null) {
          return -1;
        } else if (mapping[b] != null) {
          return 1;
        } else {
          return naturalSort(a, b);
        }
      };
    };
    getSort = function(sorters, attr) {
      var sort;
      sort = sorters(attr);
      if ($.isFunction(sort)) {
        return sort;
      } else {
        return naturalSort;
      }
    };
    $.pivotUtilities = {
      aggregatorTemplates: aggregatorTemplates,
      aggregators: aggregators,
      renderers: renderers,
      derivers: derivers,
      locales: locales,
      naturalSort: naturalSort,
      numberFormat: numberFormat,
      sortAs: sortAs
    };

    /*
    Data Model class
     */
    PivotData = (function() {
      function PivotData(input, opts) {
        this.getAggregator = bind(this.getAggregator, this);
        this.getRowKeys = bind(this.getRowKeys, this);
        this.getColKeys = bind(this.getColKeys, this);
        this.sortKeys = bind(this.sortKeys, this);
        this.arrSort = bind(this.arrSort, this);
        this.aggregator = opts.aggregator;
        this.aggregatorName = opts.aggregatorName;
        this.colAttrs = opts.cols;
        this.rowAttrs = opts.rows;
        this.valAttrs = opts.vals;
		this.hiddenVals = opts.hiddenVals;
		this.valAttrs = this.valAttrs.concat(this.hiddenVals);
		this.valLabel = opts.valueLabels;
		this.hideVals = opts.hideVals;
        this.sorters = opts.sorters;
		this.sortedAttrs = opts.sortedAttrs;
        this.tree = [this.aggregatorName.length];
        this.rowKeys = [];
		this.displayRowKeys = [];
        this.colKeys = [];
		this.displayColKeys = [];
        this.rowTotals = [];
        this.colTotals = [];
		this.allTotal = [];

		if (this.aggregatorName.length === 0) {
			this.allTotal[0] = this.aggregator[0](this, [], []);
			this.rowTotals[0] = {};
			this.colTotals[0] = {};
			this.tree[0] = {};
		} else {
			for (var i=0; i < this.aggregatorName.length; i++) {
				this.allTotal[i] = this.aggregator[i](this, [], []);
				this.rowTotals[i] = {};
				this.colTotals[i] = {};
				this.tree[i] = {};
			}
		}
        this.sorted = false;
        PivotData.forEachRecord(input, opts.derivedAttributes, (function(_this) {
          return function(record) {
			if (opts.filter(record)) {
			  _this.valAttrs.forEach(function(val, i) {
				 _this.processRecord(record, opts.aggregatorName, i);
			  });
			  return true;
            }
          };
        })(this));
      }

      PivotData.forEachRecord = function(input, derivedAttributes, f) {
        var addRecord, compactRecord, i, j, k, l, len1, record, ref, results, results1, tblCols;
        if ($.isEmptyObject(derivedAttributes)) {
          addRecord = f;
        } else {
          addRecord = function(record) {
            var k, ref, v;
            for (k in derivedAttributes) {
              v = derivedAttributes[k];
              record[k] = (ref = v(record)) != null ? ref : record[k];
            }
            return f(record);
          };
        }
        if ($.isFunction(input)) {
          return input(addRecord);
        } else if ($.isArray(input)) {
          if ($.isArray(input[0])) {
            results = [];
            for (i in input) {
              if (!hasProp.call(input, i)) continue;
              compactRecord = input[i];
              if (!(i > 0)) {
                continue;
              }
              record = {};
              ref = input[0];
              for (j in ref) {
                if (!hasProp.call(ref, j)) continue;
                k = ref[j];
                record[k] = compactRecord[j];
              }
              results.push(addRecord(record));
            }
            return results;
          } else {
            results1 = [];
            for (l = 0, len1 = input.length; l < len1; l++) {
              record = input[l];
              results1.push(addRecord(record));
            }
            return results1;
          }
        } else if (input instanceof jQuery) {
          tblCols = [];
          $("thead > tr > th", input).each(function(i) {
            return tblCols.push($(this).text());
          });
          return $("tbody > tr", input).each(function(i) {
            record = {};
            $("td", this).each(function(j) {
              return record[tblCols[j]] = $(this).html();
            });
            return addRecord(record);
          });
        } else {
          throw new Error("unknown input format");
        }
      };

      PivotData.convertToArray = function(input) {
        var result;
        result = [];
        PivotData.forEachRecord(input, {}, function(record) {
          return result.push(record);
        });
        return result;
      };

      PivotData.prototype.arrSort = function(attrs, sortedAttrs) {
		var a, sortersArr;
		sortedAttrs = sortedAttrs || [];

        sortersArr = (function() {
          var l, len1, results;
          results = [];
          for (l = 0, len1 = attrs.length; l < len1; l++) {
            a = attrs[l];
			if (a != 'Values')
				results.push(getSort(this.sorters, a));
			else
				results.push(valueSort);

          }
          return results;
        }).call(this);
        return function(a, b) {
          var comparison, i, sorter;
          for (i in sortersArr) {
            sorter = sortersArr[i];

			if (sortedAttrs.hasOwnProperty(attrs[i]))
				comparison = sorter(sortedAttrs[attrs[i]].indexOf(a[i]), sortedAttrs[attrs[i]].indexOf(b[i]))
			else
				comparison = sorter(a[i], b[i]);
            if (comparison !== 0) {
              return comparison;
            }
          }
          return 0;
        };
      };

      PivotData.prototype.sortKeys = function() {
        if (!this.sorted) {
          this.sorted = true;
		  this.displayRowKeys.sort(this.arrSort(this.rowAttrs, this.sortedAttrs));
		  this.displayColKeys.sort(this.arrSort(this.colAttrs, this.sortedAttrs));
		  return true;
        }
      };

      PivotData.prototype.getColKeys = function() {
        this.sortKeys();
        return this.colKeys;
      };

      PivotData.prototype.getRowKeys = function() {
        this.sortKeys();
        return this.rowKeys;
      };

	  PivotData.prototype.getColDisplayKeys = function() {
        this.sortKeys();
        return this.displayColKeys;
      };

      PivotData.prototype.getRowDisplayKeys = function() {
        this.sortKeys();
        return this.displayRowKeys;
      };

	  // Scan array of attributes and outputs value index if found
	  PivotData.prototype.getValueIndex = function(colKey, rowKey) {
		var idx = colKey.map(function(d) { return $.inArray(d, this.valAttrs); }).filter(function(e) { return e > -1;})[0];
		if (typeof(idx) === 'undefined')
			idx = rowKey.map(function(d) { return $.inArray(d, this.valAttrs); }).filter(function(e) { return e > -1;})[0];
		if (typeof(idx) === 'undefined')
			idx = -1;
		return idx;
	  };

      PivotData.prototype.processRecord = function(record, aggregatorNames, idx) {
        var colKey, valAttrs, flatColKey, flatRowKey, l, len1, len2, n, ref, ref1, ref2, ref3, rowKey, x;
        colKey = [];
        rowKey = [];
        ref = this.colAttrs;
		ref2 = this.rowAttrs;
		valAttrs = this.valAttrs

        for (l = 0, len1 = ref.length; l < len1; l++) {
		  x = ref[l];
		  if (x != 'Values')
			colKey.push((ref1 = record[x]) != null ? ref1 : "null");
		  else
			colKey.push(this.valAttrs[idx]);
        }

        for (n = 0, len2 = ref2.length; n < len2; n++) {
          x = ref2[n];
		  if (x != 'Values')
			rowKey.push((ref3 = record[x]) != null ? ref3 : "null");
		 else
			rowKey.push(this.valAttrs[idx]);
        }

        flatRowKey = rowKey.join(String.fromCharCode(0));
        flatColKey = colKey.join(String.fromCharCode(0));

		this.allTotal[idx].push(record, 0, this.valAttrs[idx]);

        if (rowKey.length !== 0) {
			if (!this.rowTotals[idx][flatRowKey]) {
				if ($.inArray(rowKey, this.rowKeys) == -1 || this.valLabel == 'row') {
					var checkValue = this.rowKeys.map(function(d) {
						var check = d.map(function(e) { return $.inArray(e, valAttrs); }).filter(function(e) { return e > -1; }).length > 0 ; return check;
					});

					if (idx == 0 || checkValue.filter(function(d) { return d; }).length > 0) {
						this.rowKeys.push(rowKey);

						// Hide values if marked as hidden
						var include = true;
						this.hideVals.forEach(function(hideVal) {
							if ($.inArray(hideVal, rowKey) > -1)
								include = false;
						});
						this.hiddenVals.forEach(function(hideVal) {
							if ($.inArray(hideVal, rowKey) > -1)
								include = false;
						});
						if (include)
							this.displayRowKeys.push(rowKey);
					}
				}

				this.rowTotals[idx][flatRowKey] = this.aggregator[idx](this, rowKey, []);
			}
			this.rowTotals[idx][flatRowKey].push(record);
        }

        if (colKey.length !== 0) {
			if (!this.colTotals[idx][flatColKey]) {
				if ($.inArray(colKey, this.colKeys) == -1 || this.valLabel == 'col')
					// Check if any of the column keys are values
					var checkValue = this.colKeys.map(function(d) {
						var check = d.map(function(e) { return $.inArray(e, valAttrs); }).filter(function(e) { return e > -1; }).length > 0 ; return check;
					});

					if (idx == 0 || checkValue.filter(function(d) { return d; }).length > 0) {
						this.colKeys.push(colKey);

						// Hide values if marked as hidden
						var include = true;
						this.hideVals.forEach(function(hideVal) {
							if ($.inArray(hideVal, colKey) > -1)
								include = false;
						});
						this.hiddenVals.forEach(function(hideVal) {
							if ($.inArray(hideVal, colKey) > -1)
								include = false;
						});
						if (include)
							this.displayColKeys.push(colKey);
					}
				this.colTotals[idx][flatColKey] = this.aggregator[idx](this, [], colKey);
			}
			this.colTotals[idx][flatColKey].push(record);
        }
        if (colKey.length !== 0 && rowKey.length !== 0) {
			if (!this.tree[idx][flatRowKey]) {
				this.tree[idx][flatRowKey] = {};
			}
			if (!this.tree[idx][flatRowKey][flatColKey]) {
				this.tree[idx][flatRowKey][flatColKey] = this.aggregator[idx](this, rowKey, colKey)
			}
			this.tree[idx][flatRowKey][flatColKey].push(record);
        }
      };

      PivotData.prototype.getAggregator = function(rowKey, colKey, idx) {
        var agg, flatColKey, flatRowKey;
        flatRowKey = rowKey.join(String.fromCharCode(0));
        flatColKey = colKey.join(String.fromCharCode(0));

        if (rowKey.length === 0 && colKey.length === 0) {
		  agg = this.allTotal[idx];
        } else if (rowKey.length === 0) {
          agg = this.colTotals[idx][flatColKey];
        } else if (colKey.length === 0) {
          agg = this.rowTotals[idx][flatRowKey];
        } else {
          agg = this.tree[idx][flatRowKey][flatColKey];
        }
        return agg != null ? agg : {
          value: (function() {
            return null;
          }),
          format: function() {
            return "";
          }
        };
      };

      return PivotData;

    })();

	/* Default Renderer for hierarchical table layout */
	pivotTableRenderer = function(pivotData, opts) {
		var aggregator, c, colAttrs, colKey, colKeys, defaults, i, j, r, result, rowAttrs, rowKey, rowKeys, spanSize, td, th, totalAggregator, tr, txt, val, x;
		defaults = { // Default string values
			localeStrings: { totals: "Totals" }
		};

		opts = $.extend(defaults, opts);
		colAttrs = pivotData.colAttrs, rowAttrs = pivotData.rowAttrs, valAttrs = pivotData.valAttrs, hiddenVals = pivotData.hiddenVals;

		valAttrs = valAttrs.filter(function(v) { return $.inArray(v, hiddenVals) == -1; }); // Remove hidden values
		valLabel = pivotData.valLabel;
		rowKeys = pivotData.getRowKeys(), colKeys = pivotData.getColKeys();

		result = $("<table></table>");
		result.addClass("pvtTable");

		// Wrapper for scrolling content (columns)
		var scrollBarWidth = Modernizr.hiddenscroll ? 0 : 17;
		var widthLessScroll = opts.width - scrollBarWidth;
		result.append('<tr><td class="firstTd corner"></td><td style="padding: 0"><div class="colHeader" style="width: ' + widthLessScroll + 'px;"><table cellspacing="0"></table></div></td></tr>');

		colKeys = pivotData.displayColKeys;
		rowKeys = pivotData.displayRowKeys;

		spanSize = function(arr, i, j) {
			var l, len, n, noDraw, ref, ref1, stop, x;
			if (i !== 0) {
				noDraw = true;
				for (x = l = 0, ref = j; 0 <= ref ? l <= ref : l >= ref; x = 0 <= ref ? ++l : --l) {
					if (arr[i - 1][x] !== arr[i][x]) {
						noDraw = false;
					}
				}
				if (noDraw) {
					return -1;
				}
			}
			len = 0;
			while (i + len < arr.length) {
				stop = false;
				for (x = n = 0, ref1 = j; 0 <= ref1 ? n <= ref1 : n >= ref1; x = 0 <= ref1 ? ++n : --n) {
					if (arr[i][x] !== arr[i + len][x]) {
						stop = true;
					}
				}
				if (stop) {
					break;
				}
				len++;
			}
			return len;
		};

		$('<div class="columnName"></div>').appendTo(result.find('.corner'));

		// Column Headers
		for (j in colAttrs) {
			if (!hasProp.call(colAttrs, j)) continue;
			c = colAttrs[j];
			tr = document.createElement("tr");
			tr.setAttribute("colLabels", j);

			for (i in colKeys) {
				if (!hasProp.call(colKeys, i)) continue;
				colKey = colKeys[i];
				x = spanSize(colKeys, parseInt(i), parseInt(j));
				if (x !== -1) {
					th = document.createElement("th");
					th.className = "pvtColLabel";
					th.innerHTML = '<div class="textbox" style="width: ' + opts.columnWidth + 'px">' + colKey[j] + '</div>';
					th.setAttribute("colspan", x);
					th.setAttribute("pvt-header", c);
					if (parseInt(j) === colAttrs.length - 1 && rowAttrs.length !== 0) {
						th.setAttribute("rowspan", 1);
					}

					// Hover over headers for column name
					var colDiv = result.find('.columnName');
					$(th).mouseover(function() {
						colDiv.text($(this).attr('pvt-header'));
						colDiv.stop().fadeIn(200);
					}).mouseout(function() {
						colDiv.stop().fadeOut(200);
					});

					tr.appendChild(th);
				}
			}

			$(tr).appendTo(result.find('.colHeader>table'));
		}

		var heightLessScroll = opts.height-scrollBarWidth;
		result.append('<tr><td style="padding: 0"><div class="rowHeader" style="margin-top: -' + scrollBarWidth + 'px; height:' + heightLessScroll + 'px;"><table cellspacing="0"></table></div></td></tr>');

		// Row labels
		for (i in rowKeys) {
			if (!hasProp.call(rowKeys, i)) continue;
			rowKey = rowKeys[i];
			tr = document.createElement("tr");

			for (j in rowKey) {
				c = rowAttrs[j];
				if (!hasProp.call(rowKey, j)) continue;
				txt = rowKey[j];
				x = spanSize(rowKeys, parseInt(i), parseInt(j));
				if (x !== -1) {
					th = document.createElement("th");
					th.className = "pvtRowLabel";
					th.innerHTML = txt;
					th.setAttribute("rowspan", x);
					th.setAttribute('pvt-header', rowAttrs[j]);
					th.setAttribute('row-index', j);
					if (parseInt(j) === rowAttrs.length - 1 && colAttrs.length !== 0) {
						th.setAttribute("colspan", 1);
					}

					// Hover over headers for column name
					var colDiv = result.find('.columnName');
					$(th).mouseover(function() {
						colDiv.text($(this).attr('pvt-header'));
						colDiv.stop().fadeIn(200);
					}).mouseout(function() {
						colDiv.stop().fadeOut(200);
					});

					tr.appendChild(th);
				}
			}

			$(tr).appendTo(result.find('.rowHeader>table'));
		};

		var content = $('<td style="padding: 0;"><div class="content" style="overflow-x: scroll; overflow-y: scroll; width:' + opts.width + 'px;height:' + opts.height + 'px;position:relative"><table cellspacing="0"></table></div></td>');
		content.appendTo(result.find('.rowHeader').parent().parent());

		// Content
		for (i in rowKeys) {
			if (!hasProp.call(rowKeys, i)) continue;
			rowKey = rowKeys[i];
			tr = document.createElement("tr");
			if (i == 0)
				tr.setAttribute('class', 'firstRow');

			for (j in colKeys) {
				if (!hasProp.call(colKeys, j)) continue;
				colKey = colKeys[j];

				var valIdx = pivotData.getValueIndex(colKey, rowKey);
				aggregator = pivotData.getAggregator(rowKey, colKey, valIdx);
				val = aggregator.value();
				td = document.createElement("td");
				td.className = "pvtVal row" + i + " col" + j;
				td.innerHTML = '<div class="textbox" style="width: ' + opts.columnWidth + 'px">' + opts.columnMap.measures[valIdx].format(val) + '</div>';

				var datum = {};
				var valLocation = rowAttrs.indexOf('Values') == -1 ? colAttrs.indexOf('Values') : rowAttrs.indexOf('Values');

				// Get data items for rows
				rowKey.forEach(function(k, i) {
					if (pivotData.rowAttrs[i] == 'Values') { // If values are rows
						inpR = [];
						rowKey.forEach(function(c) {
							inpR.push(c);
						});

						valAttrs.forEach(function(valAttr, i) { // Process real measures
							inpR[valLocation] = valAttr;
							datum['measures' + i] = pivotData.getAggregator(inpR, colKey, i).value();
						});

						hiddenVals.forEach(function(hiddenAttr, i) { // Process hidden measures
							inpC[valLocation] = hiddenAttr;
							datum['hidden' + i] = pivotData.getAggregator(rowKey, inpC, i + valAttrs.length).value();
						});
						datum.valIdx = valIdx;
					} else
						datum[obiee.getColIDFromName(pivotData.rowAttrs[i], opts.columnMap)] = k;
				});

				colKey.forEach(function(k, i) {
					if (pivotData.colAttrs[i] == 'Values') { // If values are columns
						inpC = [];
						colKey.forEach(function(c) {
							inpC.push(c);
						});

						valAttrs.forEach(function(valAttr, i) { // Process real measuress
							inpC[valLocation] = valAttr;
							datum['measures' + i] = pivotData.getAggregator(rowKey, inpC, i).value();
						});

						hiddenVals.forEach(function(hiddenAttr, i) { // Process hidden measures
							inpC[valLocation] = hiddenAttr;
							datum['hidden' + i] = pivotData.getAggregator(rowKey, inpC, i + valAttrs.length).value();
						});

						datum.valIdx = valIdx;
					} else
						datum[obiee.getColIDFromName(pivotData.colAttrs[i], opts.columnMap)] = k;
				});

				td.setAttribute("data-value", val);
				d3.select(td).datum(datum);
				td.setAttribute("value-index", valIdx);
				tr.appendChild(td);
			}

			$(tr).appendTo(result.find('.content>table'));
		};

		tr = document.createElement("tr");
		$(tr).appendTo(result.find('.content>table'));

		// Column totals
		result.append('<tr><td style="padding: 0"><div class="colTotals" style="width: ' + widthLessScroll + 'px;"><table cellspacing="0"></table></div></td></tr>');

		// Column total label
		th = document.createElement("th");
		th.className = "pvtTotalLabel colTotal";
		th.innerHTML = '<div>' + opts.localeStrings.totals + '</div>';
		if (valLabel == 'row') th.setAttribute('rowspan', valAttrs.length);
		$(th).prependTo(result.find('.colTotals').parent().parent())

		if (valLabel == 'col') { // Measures as columns
			tr = document.createElement("tr");
			for (j in colKeys) {
				// Column total cells
				if (!hasProp.call(colKeys, j)) continue;
				colKey = colKeys[j];
				var valIdx = pivotData.getValueIndex(colKey, rowKey);
				totalAggregator = pivotData.getAggregator([], colKey, valIdx);
				val = totalAggregator.value();
				td = document.createElement("td");
				td.className = "pvtTotal colTotal";
				td.innerHTML = '<div class="textbox" style="width: ' + opts.columnWidth + 'px">' + opts.columnMap.measures[valIdx].format(val) + '</div>';
				td.setAttribute("data-value", val);
				td.setAttribute("data-for", "col" + j);
				tr.appendChild(td);
			}
			$(tr).appendTo(result.find('.colTotals>table'));
		} else { // Measures as rows
			valAttrs.forEach(function(valAttr, x) {
				tr = document.createElement("tr");
				for (j in colKeys) {
					// Column total cells
					if (!hasProp.call(colKeys, j)) continue;
					colKey = colKeys[j];
					totalAggregator = pivotData.getAggregator([], colKey, x);
					val = totalAggregator.value();
					td = document.createElement("td");
					td.className = "pvtTotal colTotal";
					td.innerHTML = '<div class="textbox" style="width: ' + opts.columnWidth + 'px">' + opts.columnMap.measures[x].format(val) + '</div>';
					td.setAttribute("data-value", val);
					td.setAttribute("data-for", "col" + j);
					tr.appendChild(td);
				}
				$(tr).appendTo(result.find('.colTotals>table'));
			});
		}


		// Row totals
		var rowTotals = $('<td style="padding: 0"><div class="rowTotals" style="margin-top: -' + scrollBarWidth + 'px; height: ' + heightLessScroll + 'px;"><table cellspacing="0"></table></div></td>');
		rowTotals.appendTo(result.find('.content').parent().parent());

		// Row total label
		th = document.createElement('th');
		th.setAttribute('padding', '0');
		th.className = 'pvtTotalLabel rowTotal';
		th.innerHTML = opts.localeStrings.totals;
		$(th).appendTo(result.find('.colHeader').parent().parent());
		if (valLabel == 'col') {
			rowKeys.forEach(function(rowKey, i) {
				tr = document.createElement("tr");
				valAttrs.forEach(function(valAttr, x) {
					totalAggregator = pivotData.getAggregator(rowKey, [], x);
					val = totalAggregator.value();
					td = document.createElement("td");
					td.className = "pvtTotal rowTotal";
					td.innerHTML = opts.columnMap.measures[x].format(val);
					td.setAttribute("data-value", val);
					td.setAttribute("data-for", "row" + i);
					tr.appendChild(td);
				});
				$(tr).appendTo(result.find('.rowTotals>table'));
			});
		} else {
			rowKeys.forEach(function(rowKey, i) {
				tr = document.createElement("tr");
				var valIdx = pivotData.getValueIndex(colKey, rowKey);
				totalAggregator = pivotData.getAggregator(rowKey, [], valIdx);
				val = totalAggregator.value();
				td = document.createElement("td");
				td.className = "pvtTotal rowTotal";
				td.innerHTML = opts.columnMap.measures[valIdx].format(val);
				td.setAttribute("data-value", val);
				td.setAttribute("data-for", "row" + i);
				tr.appendChild(td);
				$(tr).appendTo(result.find('.rowTotals>table'));
			});
		}

		// Formatting tidyup for unusual row/column selections
		if (valLabel == 'col' && colAttrs.length == 1)
			$(result).find('.rowTotal, .pvtGrandTotal').hide();
		else if (valLabel == 'row' && rowAttrs.length == 1)
			$(result).find('.colTotal, .pvtGrandTotal').hide();
		else if (valLabel == 'col' && rowAttrs.length == 0)
			$(result).find('.pvtTotalLabel.colTotal').hide();

		result.attr("data-numrows", rowKeys.length);
		result.attr("data-numcols", colKeys.length);
		return result;
	};


	/*
    Pivot Table core: create PivotData object and call Renderer on it
     */
    $.fn.pivot = function(input, opts) {
      var defaults, e, pivotData, result, x;
      defaults = {
        cols: [],
        rows: [],
        vals: [],
        filter: function() {
          return true;
        },
        aggregator: aggregatorTemplates.count()(),
        aggregatorName: "Count",
        sorters: function() {},
        derivedAttributes: {},
        renderer: pivotTableRenderer,
        rendererOptions: null,
        localeStrings: locales.en.localeStrings
      };
      opts = $.extend(defaults, opts);

      result = null;
      try {
        pivotData = new PivotData(input, opts);
        try {
          result = opts.renderer(pivotData, opts.rendererOptions);
        } catch (_error) {
          e = _error;
          if (typeof console !== "undefined" && console !== null) {
            console.error(e.stack);
          }
          result = $("<span>").html(opts.localeStrings.renderError);
        }
      } catch (_error) {
        e = _error;
        if (typeof console !== "undefined" && console !== null) {
          console.error(e.stack);
        }
        result = $("<span>").html(opts.localeStrings.computeError);
      }
      x = this[0];
      while (x.hasChildNodes()) {
        x.removeChild(x.lastChild);
      }
      return this.append(result);
    };

    /*
    Pivot Table UI: calls Pivot Table core above with options set by user
     */
    $.fn.pivotUI = function(input, inputOpts, overwrite, locale) {
	  var a, aggregator, attrLength, axisValues, c, colList, defaults, e, existingOpts, fn, i, initialRender, k, l, len1, len2, len3, len4, n, o, opts, pivotTable, q, ref, ref1, ref2, ref3, ref4, refresh, refreshDelayed, renderer, rendererControl, shownAttributes, tblCols, tr1, tr2, uiTable, unusedAttrsVerticalAutoCutoff, unusedAttrsVerticalAutoOverride, x;
      if (overwrite == null) { // Overwrite by default
        overwrite = true;
      }
      if (locale == null) {
        locale = "en";
      }
      if (locales[locale] == null) {
        locale = "en";
      }
      defaults = {
        derivedAttributes: {},
        aggregators: locales[locale].aggregators,
        renderers: locales[locale].renderers,
        hiddenAttributes: [],
        menuLimit: 200,
        cols: [],
        rows: [],
        vals: [],
		hideVals: [],
		hiddenVals: inputOpts.hidden,
		valueCol: false,
		sortedAttrs: {},
        exclusions: {},
        inclusions: {},
        unusedAttrsVertical: 85,
        autoSortUnusedAttrs: false,
        rendererOptions: {
          localeStrings: locales[locale].localeStrings
        },
        onRefresh: null,
        filter: function() {
          return true;
        },
        sorters: function() {},
        localeStrings: locales[locale].localeStrings
      };
      existingOpts = this.data("pivotUIOptions");
      if ((existingOpts == null) || overwrite) {
        opts = $.extend(defaults, inputOpts);
      } else {
        opts = existingOpts;
      }
      try {
        input = PivotData.convertToArray(input);
        tblCols = (function() {
          var ref, results;
          ref = input[0];
          results = [];
          for (k in ref) {
            if (!hasProp.call(ref, k)) continue;
            results.push(k);
          }
          return results;
        })();
        ref = opts.derivedAttributes;
        for (c in ref) {
          if (!hasProp.call(ref, c)) continue;
          if ((indexOf.call(tblCols, c) < 0)) {
            tblCols.push(c);
          }
        }
        axisValues = {};
        for (l = 0, len1 = tblCols.length; l < len1; l++) {
          x = tblCols[l];
          axisValues[x] = {};
        }
        PivotData.forEachRecord(input, opts.derivedAttributes, function(record) {
          var base, results, v;
          results = [];
          for (k in record) {
            if (!hasProp.call(record, k)) continue;
            v = record[k];
            if (!(opts.filter(record))) {
              continue;
            }
            if (v == null) {
              v = "null";
            }
            if ((base = axisValues[k])[v] == null) {
              base[v] = 0;
            }
            results.push(axisValues[k][v]++);
          }
          return results;
        });

        uiTable = $("<table>", {
          "class": "pvtUi"
        }).attr("cellpadding", 5);
        rendererControl = $("<td>");
        renderer = $("<select>").addClass('pvtRenderer').appendTo(rendererControl).bind("change", function() {
          return refresh();
        });
        ref1 = opts.renderers;
        for (x in ref1) {
          if (!hasProp.call(ref1, x)) continue;
          $("<option>").val(x).html(x).appendTo(renderer);
        }
        colList = $("<td>").addClass('pvtAxisContainer pvtUnused');
        shownAttributes = (function() {
          var len2, n, results;
          results = [];
          for (n = 0, len2 = tblCols.length; n < len2; n++) {
            c = tblCols[n];
            if (indexOf.call(opts.hiddenAttributes, c) < 0) {
              results.push(c);
            }
          }
          return results;
        })();
        unusedAttrsVerticalAutoOverride = false;
        if (opts.unusedAttrsVertical === "auto") {
          unusedAttrsVerticalAutoCutoff = 120;
        } else {
          unusedAttrsVerticalAutoCutoff = parseInt(opts.unusedAttrsVertical);
        }
        if (!isNaN(unusedAttrsVerticalAutoCutoff)) {
          attrLength = 0;
          for (n = 0, len2 = shownAttributes.length; n < len2; n++) {
            a = shownAttributes[n];
            attrLength += a.length;
          }
          unusedAttrsVerticalAutoOverride = attrLength > unusedAttrsVerticalAutoCutoff;
        }
        if (opts.unusedAttrsVertical === true || unusedAttrsVerticalAutoOverride) {
          colList.addClass('pvtVertList');
        } else {
          colList.addClass('pvtHorizList');
        }
        fn = function(c) {
          var attrElem, btns, checkContainer, filterItem, filterItemExcluded, hasExcludedItem, keys, len3, o, ref2, showFilterList, triangleLink, updateFilter, v, valueList;
          keys = (function() {
            var results;
            results = [];
            for (k in axisValues[c]) {
              results.push(k);
            }
            return results;
          })();
          hasExcludedItem = false;
          valueList = $("<div>").addClass('pvtFilterBox').hide();
          valueList.append($("<h4>").text(c + " (" + keys.length + ")"));
          if (keys.length > opts.menuLimit) {
            valueList.append($("<p>").html(opts.localeStrings.tooMany));
          } else {
            btns = $("<p>").appendTo(valueList);

            btns.append($("<i>").addClass('fa fa-check-square-o pvtControl').css({'font-size' : '20px', 'margin-right' : '5px'}).bind("click", function() {
              return valueList.find("input:visible").prop("checked", true);
            }));

            btns.append($("<i>").addClass('fa fa-times-circle pvtControl').css({'font-size' : '20px', 'margin-right' : '10px'}).bind("click", function() {
              return valueList.find("input:visible").prop("checked", false);
            }));
            btns.append($("<input>", {
              type: "text",
              placeholder: opts.localeStrings.filterResults,
              "class": "pvtSearch"
            }).bind("keyup", function() {
              var filter;
              filter = $(this).val().toLowerCase();
              return valueList.find('.pvtCheckContainer p').each(function() {
                var testString;
                testString = $(this).text().toLowerCase().indexOf(filter);
                if (testString !== -1) {
                  return $(this).show();
                } else {
                  return $(this).hide();
                }
              });
            }));
            checkContainer = $("<div>").addClass("pvtCheckContainer").appendTo(valueList);
            ref2 = keys.sort(getSort(opts.sorters, c));
            for (o = 0, len3 = ref2.length; o < len3; o++) {
              k = ref2[o];
              v = axisValues[c][k];
              filterItem = $("<label>");
              filterItemExcluded = false;
              if (opts.inclusions[c]) {
                filterItemExcluded = (indexOf.call(opts.inclusions[c], k) < 0);
              } else if (opts.exclusions[c]) {
                filterItemExcluded = (indexOf.call(opts.exclusions[c], k) >= 0);
              }
              hasExcludedItem || (hasExcludedItem = filterItemExcluded);
              $("<input>").attr("type", "checkbox").addClass('pvtFilter').attr("checked", !filterItemExcluded).data("filter", [c, k]).appendTo(filterItem);
              filterItem.append($("<span>").html(k));
              checkContainer.append($("<p>").append(filterItem));
            }
          }
          updateFilter = function() {
            var unselectedCount;
            unselectedCount = valueList.find("[type='checkbox']").length - valueList.find("[type='checkbox']:checked").length;
            if (unselectedCount > 0) {
              attrElem.addClass("pvtFilteredAttribute");
            } else {
              attrElem.removeClass("pvtFilteredAttribute");
            }
            if (keys.length > opts.menuLimit) {
              return valueList.toggle();
            } else {
              return valueList.toggle(0, refresh);
            }
          };
          $("<p>").appendTo(valueList).append($("<i>").addClass('fa fa-2x fa-check pvtControl').bind("click", updateFilter));
          showFilterList = function(e) {
            var clickLeft, clickTop, ref3;
            ref3 = $(e.currentTarget).position(), clickLeft = ref3.left, clickTop = ref3.top;
            valueList.css({
              left: clickLeft + 10,
              top: clickTop + 10
            }).toggle();
            valueList.find('.pvtSearch').val('');
            return valueList.find('.pvtCheckContainer p').show();
          };
          triangleLink = $("<span>").addClass('pvtTriangle').html(" &#x25BE;").bind("click", showFilterList);
          attrElem = $("<li>").addClass("pvtDragLabel axis_" + i).append($("<span>").addClass('pvtAttr').text(c).data("attrName", c).append(triangleLink));
          if (hasExcludedItem) {
            attrElem.addClass('pvtFilteredAttribute');
          }

		  if ($.inArray(c, opts.vals) == -1)
			colList.append(attrElem).append(valueList);

		  return attrElem.bind("dblclick", showFilterList);
        };

        for (i in shownAttributes) {
          if (!hasProp.call(shownAttributes, i)) continue;
          c = shownAttributes[i];
          fn(c);
        }
        tr1 = $("<tr>").appendTo(uiTable);
        aggregator = $("<select>").addClass('pvtAggregator').bind("change", function() {
          return refresh();
        });
        ref2 = opts.aggregators;
        for (x in ref2) {
          if (!hasProp.call(ref2, x)) continue;
          aggregator.append($("<option>").val(x).html(x));
        }

        $("<td>").addClass('pvtVals').attr('colspan', '2').appendTo(tr1); // Removing aggregator from values box

		$("<td>").addClass('pvtAxisContainer pvtHorizList pvtCols').appendTo(tr1);
        tr2 = $("<tr>").appendTo(uiTable);
        tr2.append($("<td>").addClass('pvtAxisContainer pvtRows').attr({"valign" : "top", "colspan" : "2"}));
        pivotTable = $("<td>").attr("valign", "top").addClass('pvtRendererArea').appendTo(tr2);


		excludeLabel = $("<td>Exclude: </td>").addClass('excludeLabel').css({'font-weight' : 'bold', 'text-align' : 'right' });
        if (opts.unusedAttrsVertical === true || unusedAttrsVerticalAutoOverride) {
          uiTable.find('tr:nth-child(1)').prepend(rendererControl).prepend(excludeLabel);

          uiTable.find('tr:nth-child(2)').prepend(colList);
        } else {
          uiTable.prepend($("<tr>").append(rendererControl).append(excludeLabel).append(colList));
        }

        this.html(uiTable);
        ref3 = opts.cols;
        for (o = 0, len3 = ref3.length; o < len3; o++) {
          x = ref3[o];
          this.find(".pvtCols").append(this.find(".axis_" + ($.inArray(x, shownAttributes))));
        }
        ref4 = opts.rows;
        for (q = 0, len4 = ref4.length; q < len4; q++) {
          x = ref4[q];
          this.find(".pvtRows").append(this.find(".axis_" + ($.inArray(x, shownAttributes))));
        }

        if (opts.rendererName != null) {
          this.find(".pvtRenderer").val(opts.rendererName);
        }

        initialRender = true;
        refreshDelayed = (function(_this) {
          return function() {

			var attr, exclusions, inclusions, len5, newDropdown, numInputsToProcess, pivotUIOptions, pvtVals, ref5, ref6, s, subopts, t, unusedAttrsContainer, vals;
			subopts = {
              derivedAttributes: opts.derivedAttributes,
              localeStrings: opts.localeStrings,
              rendererOptions: opts.rendererOptions,
              sorters: opts.sorters,
              cols: [],
              rows: [],
			  hideVals: [],
			  sortedAttrs: opts.sortedAttrs
            };

			// Add value label
			if (_this.find('.pvtValueLabel').length == 0) {
				valueLabel = $("<li>").addClass('pvtValueLabel pvtDragLabel').append($("<span>").addClass('pvtAttr').text('Values').data("attrName", 'Values'));
				if (opts.valueCol)
					$('.pvtAxisContainer.pvtCols').append(valueLabel);
				else
					$('.pvtAxisContainer.pvtRows').append(valueLabel);
			}

            numInputsToProcess = (ref5 = opts.aggregators[aggregator.val()]([])().numInputs) != null ? ref5 : 0;
            vals = [];

			// Populate row attributes
            _this.find(".pvtRows li span.pvtAttr").each(function() {
              return subopts.rows.push($(this).data("attrName"));
            });

			// Populate column attributes
            _this.find(".pvtCols li span.pvtAttr").each(function() {
              return subopts.cols.push($(this).data("attrName"));
            });

			// Populate value attributes
            _this.find(".pvtVals select.pvtAttrDropdown").each(function() {
              if (numInputsToProcess === 0) {
                return $(this).remove();
              } else {
                numInputsToProcess--;
                if ($(this).val() !== "") {
                  return vals.push($(this).val());
                }
              }
            });

			// Get array of values to hide
			var hideVals = [];
			_this.find('.pvtVals .toggleVal.hideVal').each(function() {
				hideVals.push($(this).next().text());
			});
			subopts.hideVals = hideVals;

            if (initialRender) {
              vals = opts.vals;
			  subopts.hideVals = opts.hideVals;

			  // Create value labels
			  vals.forEach(function(val, i) {
				var eyeClass = 'fa-eye showVal';
				if ($.inArray(val, opts.hideVals) > -1)
					eyeClass = 'fa-eye-slash hideVal';
				var attrElem = $("<li>")
					.addClass("axis_" + i)
					.append($("<i></i>")
						.addClass("toggleVal fa " + eyeClass)
						.click(function() {
							if ($(this).hasClass('fa-eye'))
								$(this).removeClass('fa-eye showVal').addClass('fa-eye-slash hideVal');
							else
								$(this).removeClass('fa-eye-slash hideVal').addClass('fa-eye showVal');
							refresh();
						})
					)
					.append($("<span>")
						.addClass('pvtAttr')
						.text(val)
						.data("attrName", val)
					);

				// Create and populate aggregator elements
				aggregator.clone().appendTo(attrElem).change(function() {
					return refresh();
				});

				attrElem.find(".pvtAggregator").val(opts.measureAggregators[val]);
				_this.find(".pvtVals").append(attrElem);
			  });

			  // Create aggregator dropdowns
              i = 0;
              _this.find(".pvtVals select.pvtAttrDropdown").each(function() {
                $(this).val(vals[i]);
                return i++;
              });
              initialRender = false;
            }

			// Find aggregators for each value
			subopts.aggregatorName = [];
			_this.find('.pvtAggregator').each(function() {
				subopts.aggregatorName.push($(this).val());
			});

			subopts.hiddenVals = opts.hiddenVals;

			// Populate values array
			vals = [];
			_this.find('.pvtVals .pvtAttr').each(function() {
				vals.push($(this).text());
			});

			subopts.vals = vals;


			// Multiple aggregators
			subopts.aggregator = [];
			subopts.aggregatorName.forEach(function(agg, i) {
				subopts.aggregator.push(opts.aggregators[agg](vals[i]));
			});

			subopts.hiddenVals.forEach(function(h) {
				subopts.aggregatorName.push('Sum');
				subopts.aggregator.push(opts.aggregators['Sum'](h));
			});

			// Measure label location
			subopts.valueLabels = "";
			if (_this.find('.pvtValueLabel').parents('.pvtAxisContainer').hasClass('pvtCols')) {
				subopts.valueLabels = "col";
			} else if (_this.find('.pvtValueLabel').parents('.pvtAxisContainer').hasClass('pvtRows')) {
				subopts.valueLabels = "row";
			} else if (_this.find('.pvtValueLabel').parents('.pvtAxisContainer').hasClass('pvtUnused')) {
				subopts.valueLabels = "unused";
			}
            subopts.renderer = opts.renderers[renderer.val()];
            exclusions = {};
            _this.find('input.pvtFilter').not(':checked').each(function() {
              var filter;
              filter = $(this).data("filter");
              if (exclusions[filter[0]] != null) {
                return exclusions[filter[0]].push(filter[1]);
              } else {
                return exclusions[filter[0]] = [filter[1]];
              }
            });
            inclusions = {};
            _this.find('input.pvtFilter:checked').each(function() {
              var filter;
              filter = $(this).data("filter");
              if (exclusions[filter[0]] != null) {
                if (inclusions[filter[0]] != null) {
                  return inclusions[filter[0]].push(filter[1]);
                } else {
                  return inclusions[filter[0]] = [filter[1]];
                }
              }
            });
            subopts.filter = function(record) {
              var excludedItems, ref7;
              if (!opts.filter(record)) {
                return false;
              }
              for (k in exclusions) {
                excludedItems = exclusions[k];
                if (ref7 = "" + record[k], indexOf.call(excludedItems, ref7) >= 0) {
                  return false;
                }
              }
              return true;
            };

            pivotTable.pivot(input, subopts);
            pivotUIOptions = $.extend(opts, {
              cols: subopts.cols,
              rows: subopts.rows,
              vals: vals,
              exclusions: exclusions,
              inclusions: inclusions,
              inclusionsInfo: inclusions,
              aggregatorName: aggregator.val(),
              rendererName: renderer.val()
            });
            _this.data("pivotUIOptions", pivotUIOptions);
            if (opts.autoSortUnusedAttrs) {
              unusedAttrsContainer = _this.find("td.pvtUnused.pvtAxisContainer");
              $(unusedAttrsContainer).children("li").sort(function(a, b) {
                return naturalSort($(a).text(), $(b).text());
              }).appendTo(unusedAttrsContainer);
            }
            pivotTable.css("opacity", 1);
            if (opts.onRefresh != null) {
              return opts.onRefresh(pivotUIOptions);
            }
			$(_this).trigger('refreshPivot', opts); // Send information to refresh event in the main function
          };
        })(this);
        refresh = (function(_this) {
          return function() {
            pivotTable.css("opacity", 0.5);
            return setTimeout(refreshDelayed, 20);
          };
        })(this);
        refresh();


		interact('.pvtDragLabel').draggable({
			onmove: function(event) {
				insights.drag.basic(event);
			},
			onend: insights.drag.snapBack
		});

		// Enable labels to be dropped into the axis container
		interact('.pvtAxisContainer').dropzone({
			accept: '.pvtDragLabel', // Only accept elements matching this CSS selector
			overlap: 'pointer', // Threshold to determine drop

			ondragenter: function(event) {
				if ($(event.target).hasClass('pvtUnused'))
					insights.drag.enter(event);
				else {
					if ($(event.target).children('li').length == 0) // If the container is empty drop regardless
						insights.drag.enter(event);
				}
			},
			ondragleave: function(event) {
				insights.drag.leave(event);
			},
			ondrop: function (event) {
				if ($(event.target).hasClass('pvtUnused')) // Drop label to unused location regardless
					$(event.target).append($(event.relatedTarget));
				else {
					if ($(event.target).children('li').length == 0) // If the container is empty drop regardless
						$(event.target).append($(event.relatedTarget));
				}
				refresh();
			},
			ondropdeactivate: insights.drag.dropDisable
		});

		// Enable labels to rearrange label order
		interact('.pvtDragLabel').dropzone({
			accept: '.pvtDragLabel', // Only accept elements matching this CSS selector
			overlap: 'pointer', // Threshold to determine drop

			ondragenter: function(event) {
				var placeHolder = $('<li class="pvtPlaceholder"></li>');

				var move;
				if ($(event.target).parent().hasClass('pvtCols'))
					move = event.dragEvent.dx;
				else
					move = event.dragEvent.dy;

				if (move >= 0)
					placeHolder.insertAfter($(event.target));
				else
					placeHolder.insertBefore($(event.target));
			},
			ondragleave: function(event) {
				$(event.target).parent().find('.pvtPlaceholder').remove();
			},
			ondrop: function (event) {
				$(event.target).parent().find('.pvtPlaceholder').remove();

				var move;

				if ($(event.target).parent().hasClass('pvtCols'))
					move = event.dragEvent.dx;
				else
					move = event.dragEvent.dy;

				if (move >= 0)
					$(event.relatedTarget).insertAfter($(event.target));
				else
					$(event.relatedTarget).insertBefore($(event.target));
				refresh();
			},
			ondropdeactivate: insights.drag.dropDisable
		});

      } catch (_error) {
        e = _error;
        if (typeof console !== "undefined" && console !== null) {
          console.error(e.stack);
        }
        this.html(opts.localeStrings.uiRenderError);
      }
      return this;
    };

	// Theme colour and conditional formatting post-processing
	function stylePivot(pvtTable, colour, condFormats, pivotData) {
		var brightness = rmvpp.getBrightness(colour);
		var dark = rmvpp.reduceSaturation(colour, 50), light = rmvpp.setBrightness(colour, 90);
		$(pvtTable).find('.pvtAxisLabel, .pvtTotalLabel, .corner').css({
			'background-color' : colour,
			'color' : brightness > 0.7 ? 'black' : 'white',
			'border-color' : rmvpp.reduceBrightness(colour, 20)
		});

		$(pvtTable).find('.pvtTotalLabel').css('border', '0px');

		$(pvtTable).find('.pvtColLabel, .pvtRowLabel').css({
			'border-color' : dark,
			'background-color' : light
		});

		setTimeout(function() { // Ensure rendering has happened to catch scrollbars
			var hScroll = $(pvtTable).find('.content').hasHorizScrollBar();
			var vScroll = $(pvtTable).find('.content').hasVertScrollBar();
			if (vScroll) {
				$(pvtTable).find('.rowHeader table tr:first-child>th').css('border-top-color', light);
				$(pvtTable).find('.rowHeader table tr:last-child>th').css('border-bottom-color', light);
				$(pvtTable).find('.rowHeader').css({
					'border-top' : '1px solid ' + dark,
					'border-bottom' : '1px solid ' + dark
				});
			}

			if (hScroll) {
				$(pvtTable).find('.colHeader table th:first-child').css('border-left-color', light);
				$(pvtTable).find('.colHeader table th:last-child').css('border-right-color', light);
				$(pvtTable).find('.firstTd').css('border-right', '1px solid ' + dark);
				$(pvtTable).find('.colHeader').css('border-right', '1px solid ' + dark);
				$(pvtTable).find('.content').css('overflow-x', 'scroll');
			}

			if (!hScroll && !vScroll)
				$(pvtTable).find('.content').css('overflow', 'hidden');

			if ($.checkBrowser() == 'chrome')
				$(pvtTable).find('.colHeader').css('margin-left', '-1px');

		}, 1);

		// Parse data from each cell
		forEachCell = function(f) {
            return _this.find('.pvtVal').each(function() {
              var x;
              x = $(this).data("value");
              if ((x != null) && isFinite(x)) {
                return f(x, $(this));
              }
            });
          };

		numRows = pvtTable.data("numrows");
		numCols = pvtTable.data("numcols");

		// Heatmap formatting
		var hm = condFormats.filter(function(cf) { return cf.Operator == 'heatmap'; });
		if (hm.length > 0) {
			// Find minimum and maximum values, for each measure and for all measures
			var max = {}, min = {}, maxArray = [], minArray = [];
			for (var i=0; i < pivotData[0].measures.length; i++) {
				max['measures' + i] = d3.max(pivotData.map(function(d) { return +d.measures[i].value; }));
				min['measures' + i] = d3.min(pivotData.map(function(d) { return +d.measures[i].value; }));
				maxArray.push(max['measures' + i]);
				minArray.push(min['measures' + i]);
			}
			max['measures'] = d3.max(maxArray);
			min['measures'] = d3.min(minArray);

			var heatScales = [];
			hm.forEach(function(h) {
				heatScales.push(rmvpp.gradientColour(h.Style.colour, min[h.SourceID], max[h.SourceID]));
			});
		}

		pvtTable.find('.pvtVal').each(function() {
			var d = d3.select(this).datum(), val = $(this).data('value') || 0, elem = this;
			var mCode = 'measures' + d.valIdx;
			condFormats.forEach(function(cf) { // Loop through conditional formats
				if (cf.TargetID == 'measures') { // If applying to all measures
					val = cf.SourceID == 'measures' ? val : d[cf.SourceID];
					if (cf.compare(val))
						$(elem).css({ 'color' : cf.Style.colour, 'font-weight' : 'bold' });
				} else {
					if (cf.compare(d[cf.SourceID]) && mCode == cf.TargetID) // Check correct measure
						$(elem).css({'color' : cf.Style.colour, 'font-weight' : 'bold'});
				}
			});

			// Process heatmap
			hm.forEach(function(cf, i) {
				if ((mCode == cf.TargetID || cf.TargetID == 'measures')) {
					var hmVal = cf.TargetID == 'measures' ? val : d[cf.SourceID];

					var b = rmvpp.getBrightness(heatScales[i](hmVal));
					var s = rmvpp.getSaturation(heatScales[i](hmVal));
					$(elem).css('background-color', heatScales[i](hmVal));

					if (b < 0.7)
						$(elem).css('color', '#FFFFFF')
					else
						$(elem).css('color', '#000000')
				}
			});
		});
	}

	$.fn.pivotTheme = function(colour, condFormats, pivotData) {
		stylePivot(this, colour, condFormats, pivotData);
		return this;
	};

	// Post processing to enable scrollable content
	$.fn.callback = function(pivotData) {
		var pivotTable = this;

		function scrollContent(event) {
			var content = pivotTable.find('.content');
			$(pivotTable).find('.colHeader, .colTotals').scrollLeft($(content).scrollLeft());
			$(pivotTable).find('.rowHeader, .rowTotals').scrollTop($(content).scrollTop());
		}

		// Browser specific column and height hacking
		$(this).find('.content').on('scroll', scrollContent);
		return this;
	}

    // Barchart post-processing
    $.fn.barchart = function(colour, condFormats, pivotData, pvtInfo, opts) {
      var barcharter, i, l, numCols, numRows, ref;
      numRows = this.data("numrows");
      numCols = this.data("numcols");
      barcharter = (function(_this) {
        return function(scope) {
          var forEachCell, max, scaler, values;
          forEachCell = function(f) {
            return _this.find(scope).each(function() {
              var x;
              x = $(this).data("value");
              if ((x != null) && isFinite(x)) {
                return f(x, $(this));
              }
            });
          };
          values = [];
          forEachCell(function(x) {
            return values.push(x);
          });
          max = Math.max.apply(Math, values);
          scaler = function(x) {
            return 100 * x / (1.4 * max);
          };
          return forEachCell(function(x, elem) {
            var text, wrapper;
            text = elem.text();
            wrapper = $("<div>").css({
              "position": "relative",
              "height": "55px",
			  "width": opts.columnWidth + 10 + "px" // 10 for padding
            });
            wrapper.append($("<div>").css({
              "position": "absolute",
              "bottom": 0,
              "left": 0,
              "right": 0,
              "height": scaler(x) + "%",
              "background-color": colour
            }));
            wrapper.append($("<div>").text(text).css({
              "position": "relative",
              "padding-left": "5px",
              "padding-right": "5px"
            }));
            return elem.css({
              "padding": 0,
              "padding-top": "5px",
              "text-align": "center"
            }).html(wrapper);
          });
        };
      })(this);
      for (i = l = 0, ref = numRows; 0 <= ref ? l < ref : l > ref; i = 0 <= ref ? ++l : --l) {
        barcharter(".pvtVal.row" + i);
      }

	  $(this).find('.pvtRowLabel[row-index=' + (+pvtInfo.rowAttrs.length - 1) + '], .pvtTotal.rowTotal').css('height', '50px');
	  stylePivot(this, colour, condFormats, pivotData); // Style table
      return this;
    };
  });

}).call(this);

//# sourceMappingURL=pivot.js.map
