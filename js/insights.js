/**
 * @overview RM Insights UI module
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* Contains functions required to manipulate UI elements for the Insights app.
	* Includes dashboard prompts, column selectors, interactivity and report exporting.
	* @exports insights
*/
var insights = (function(insights) {

	/* ------ PUBLIC PROMPT/SELECTOR FUNCTIONS ----- */

	/**
		* Applies a column select by looping through visualisations and switching columns if they're found to match one in the selector list.
		* This is only done if the visualisation is in the list of affected visuals for the selector. The visualisation is then re-rendered.
		* @param {BIColumnSelector} selector Column selector object to apply.
		* @param {BIVisual[]} visArray Full array of visualisations to potentially apply the selector to.
		* @param {string} newColID Column ID of the selected column to switch to.
		* @param {scope} scope Angular scope of the dashboard to pass to the visualisation rendering function to reactivate interactions.
		* @param {boolean} noRender Indicates that the visualisation should not be rendered regardless if a column matches.
		* @param {function} done Callback function once complete.
	*/
	insights.applyColumnSelect = function (selector, visArray, newColID, scope, noRender, callback) {
		var colIDArray = selector.Columns.map(function(d) { return d.ID; });
		var newCol = selector.Columns.filter(function(d) { return d.ID == newColID; })[0];
		newCol = new obiee.BIColumn(newCol.Code, newCol.Name, newCol.DataType, newCol.Table, newCol.Measure, newCol.SubjectArea, newCol.DataFormat);

		var updateVisuals = function() {
			selector.Visuals.forEach(function(origVis) {
				if (origVis.enabled) {
					var vis = visArray.filter(function(d) {
						if (rmvpp.Plugins[d.Plugin].multipleDatasets) {
							var datasets = obiee.getDatasetsFromSubjectArea(d.Plugin, d.Query, newCol.SubjectArea); // Get all allowed dataset IDs for this subject area
							return d.Name == origVis.name && datasets.length > 0;
						} else {
							return d.Name == origVis.name && d.Query.SubjectArea == newCol.SubjectArea;
						}
					})[0];

					if (vis) {
						// Set variables for handling multiple dataset plugins
						var multiSet = rmvpp.Plugins[vis.Plugin].multipleDatasets;
						if (multiSet) {
							// For multiple dataset plugins, this is an array of dataset IDs that can have their queries updated
							var datasets = obiee.getDatasetsFromSubjectArea(vis.Plugin, vis.Query, newCol.SubjectArea);
						} else {
							var datasets = [0]; // Hardcode one element
						}

						var refreshVis = false;

						datasets.forEach(function(ds) {
							if (multiSet) {
								var query = vis.Query[ds];
								var colMap = vis.ColumnMap[ds];
							} else {
								var query = vis.Query;
								var colMap = vis.ColumnMap;
							}

							var replaceColID, oldCol;

							for (var i=0; i < query.Criteria.length; i++) {
								if ($.inArray(query.Criteria[i].ID, colIDArray) > -1) {
									refreshVis = true;
									replaceColID = query.Criteria[i].ID;
									oldCol = query.Criteria[i];
									query.Criteria[i] = newCol;
								}
							};

							if (refreshVis) {
								// Remove sort keys that may be defined
								var oldSortCol = new obiee.BIColumn('SORTKEY(' + oldCol.Code + ')', oldCol.Name + ' (Sort)', 'integer');

								query.Criteria = query.Criteria.filter(function(c) {
									return c.Code != oldSortCol.Code;
								});


								for (attr in colMap) {
									var cMap = colMap[attr];
									if ($.isArray(cMap)) {
										for (j=0; j < cMap.length; j++) {
											if (cMap[j].ID == replaceColID)
												colMap[attr][j] = newCol;
										}
									} else {
										if (cMap.ID == replaceColID)
											colMap[attr] = newCol;
									}
								}
							}
						});

						if (!noRender && refreshVis) {
							vis.render(scope);
						}
					}
				}
			});

			if (callback) {
				callback();
			}
		}

		// Bring back column information if not already gathered
		if (!newCol.Verified) {
			newCol.verify(function() {
				updateVisuals();
			});
		} else
			updateVisuals();
	}

	/**
		* Parse URL query string and apply filters to dashboard if applicable. Accepts `n` filters by specifying the column ID (e.g. `Products.Type`)
		* and the value (`;` separate for multiple). The query string arguments should be of the form `filter1, filter2, ...`, `op1, op2, ...` and `val1, val2, ...`.
		* If matching dashboard prompts are found, the default values are updated. All visualisations are checked, but filters are only applied if they contain
		* either a column in the criteria with a matching column ID or an unprotected filter in the query with a matching column ID.
		* @param {BIDashboard} dbObj Dashboard object.
	*/
	insights.urlFilters = function(dbObj) {
		// Loop through filters in query string
		for (var i=1; i <= rmvpp.getNumQueryString('filter'); i++) {
			var code = rmvpp.getQueryString('filter'+i);
			var op = rmvpp.getQueryString('op'+i);
			var val = rmvpp.getQueryString('val'+i);
			if (dbObj.Prompts.Filters) // Update dashboard prompt
				dbObj.Prompts.Filters = updatePromptDefaultsByID(dbObj.Prompts.Filters, code, op, val);

			// Update visualisations too if they contain a matching column
			dbObj.Visuals.forEach(function(vis) {
				var found = obiee.replaceFilterByID(vis.Query.Filters, code, op, val);
				if (!found) {
					vis.Query.Criteria.forEach(function(col) {
						if (col.ID == code) {
							var filter = new obiee.BIFilter(col, val.split(';'), op, col.SubjectArea);
							vis.Query.Filters.push(filter);
						}
					});
				}
			});
		}
		return dbObj;
	}

	/** Updates default values for prompts by a column ID. For use with URL filter passing. */
	function updatePromptDefaultsByID(filters, colID, newOp, newValue) {
		for (var i=0; i < filters.length; i++) {
			if (filters[i].ColumnID == colID) {
				if (!$.isArray(newValue))
					newValue = newValue.split(';');

				filters[i].PromptOptions.DefaultValues = [];
				newValue.forEach(function(val) {
					if (filters[i].Column.Measure != 'none')
						val = +val;
					filters[i].PromptOptions.DefaultValues.push({ValueType: 'value', Value: val});
					filters[i].Operator = newOp ? newOp : 'in';
				});
			}
		}
		return filters;
	}

	/**
		* Executes LSQL to get filter choices and populates them in an array.
		* @param {BIFilter} filter Filter object to get possible values for.
		* @param {object[]} choices Array indicating selected/selectable values.
		* @param {function} callback Callback function to execute once all of the values have been fetched.
	*/
	insights.lsqlFilterChoices = function(filter, callback) {
		var biQuery = new obiee.BIQuery([filter.Column], []);
		var choices = [];
		obiee.executeLSQL(filter.PromptOptions.SQLOverride, function(results) {
			results.forEach(function(row) {
				for (col in row) {
					choices.push(row[col]);
				}
			});

			if (callback)
				callback(choices);
		}, biQuery);
	}

	/**
		* Populate filter options by asynchronously querying OBIEE as well as default values. Designed to be used with filter picklists.
		* @param {BIFilter} filter Filter object to get possible values for.
		* @param {object[]} choices Array indicating selected/selectable values.
		* @param {function} callback Callback function to execute once all of the values have been fetched.
	*/
	insights.getFilterChoices = function(filter, choices, callback) {
		if (filter.PromptOptions.DefaultValues.length > 0)
			filter.Value = []; // Clear the original value if there is a default defined

		var biQuery = new obiee.BIQuery([filter.Column], []);
		obiee.executeLSQL(filter.PromptOptions.SQLOverride, function(results) {
			results.forEach(function(row) {
				for (col in row) {
					choices.push({name: row[col], selected: false});
				};
			});

			var dfdArray = []; // Array of deferreds to allow multiple SQL expressions before executing

			insights.defaultPromptValues(filter, choices, dfdArray, insights.selectPromptChoice)

			if ($.isArray(filter.Value)) {
				filter.Value.forEach(function(v) {
					choices = insights.selectPromptChoice(choices, v);
				});
			}
			filter.Value = insights.valsFromChoices(choices);

			$.when.apply($, dfdArray).done(function() {
				if (callback) {
					callback();
				}
			});
		}, biQuery);
	}

	/**
		* Retrieves default prompt values of all types and executes a custom function to apply the values.
		* @param {BIFilter} filter Filter object to obtain defaults for.
		* @param {object[]} choices Array indicating selected values.
		* @param {deferred[]} dfdArray Array of jQuery deferred objects to allow asynchronous processes for LSQL expressions.
		* @param {function} applyFunc Callback function to apply to values once obtained.
	*/
	insights.defaultPromptValues = function(filter, choices, dfdArray, applyFunc) {
		function executeExpr(query, filter, choices) {
			var dfd = $.Deferred();

			obiee.executeLSQL(query, function(results) { // Execute LSQL query
				results.forEach(function(r) { // Assume only one column in query
					choices = applyFunc(choices, r.Column0);
				});
				if (choices)
					filter.Value = insights.valsFromChoices(choices);
				dfd.resolve();
			});

			return dfd.promise();
		}

		// Populate with default values
		filter.PromptOptions.DefaultValues.forEach(function(dv) {
			switch(dv.ValueType) {
				case 'value':
					if ($.isArray(dv.Value)) {
						dv.Value.forEach(function(v) {
							choices = applyFunc(choices, v);
						});
					} else
						applyFunc(choices, dv.Value);
					break;
				case 'repVar':
					choices = applyFunc(choices, obiee.getVariable(dv.Value, 'Repository').Value);
					break;
				case 'sessionVar':
					var vals = obiee.getVariable(dv.Value, 'Session').Value;
					if (vals) { // If variable no longer defined
						vals.forEach(function(v) {
							choices = applyFunc(choices, v);
						});
					}
					break;
				case 'expression':
					dfdArray.push($.when(executeExpr(dv.Value[0], filter, choices)))
					break;
			}
		});
	}

	/**
		* Get an array of values from the prompt choice object.
		* @param {object[]} choices Array of selectable values.
	*/
	insights.valsFromChoices = function(choices) {
		return choices.filter(function(c) {
				return c.selected;
		}).map(function(c) {
			return c.name;
		})
	}

	/**
		Update list when finding a matching value. Keeps object structure (legacy, for IST Multi Select)
		* @param {object[]} list Array of selectable values with `name` and `selected` properties.
		* @param {string} val Value to mark as selected
	*/
	insights.selectPromptChoice = function(list, val) {
		var find = false;
		list.forEach(function(l) {
			if (l.name == val) {
				l.selected = true;
				find = true;
			}
		});
		if (!find)
			list.push({name: val, selected: true});

		return list;
	}

	/**
		* Merge an array of values and the list of choices.
		* @param {object[]} choices Array of selected/selectable values.
		* @param {string[]} vals Array of values to merge with the choices list.
	*/
	insights.mergeValsChoices = function(choices, vals) {
		// Deselect all options
		choices.forEach(function(c) {
			c.selected = false;
		});

		// Select new options
		vals.forEach(function(v) {
			choices = insights.selectPromptChoice(choices, v);
		})
	};

	/**
		* Translates an operator code into readable text format.
		* @param {string} op Operator code as found in a `BIFilter` object.
		* @returns {string}
	*/
	insights.translateOperator = function(op) {
		var out = '';
		switch(op) {
			case 'in':
				out = 'Is in'; break;
			case 'notIn':
				out = 'Is not in'; break;
			case 'greater':
				out = 'Is greater than'; break;
			case 'greaterOrEqual':
				out = 'Is greater or equal to'; break;
			case 'less':
				out = 'Is less than'; break;
			case 'lessOrEqual':
				out = 'Is less than or equal to'; break;
			case 'top':
				out = 'Is in top'; break;
			case 'bottom':
				out = 'Is in bottom'; break;
			case 'like':
				out = 'Is like'; break;
			case 'contains':
				out = 'Contains'; break;
			case 'starts':
				out = 'Starts with'; break;
			case 'ends':
				out = 'Ends with'; break;
			case 'isNull':
				out = 'Is null'; break;
			case 'isNotNull':
				out = 'Is not null'; break;
		}
		return out;
	}

	/* ------ END OF PROMPT/SELECTOR FUNCTIONS ------ */

	/* ------ INTERACTION HANDLER FUNCTIONS ------ */

	/**
		* Generate an action handler based on the source and target visualisations and the action type. Can be public handlers (generic to all plugins)
		* like the filter handler (`genFilterHandler`) or defined as part of the plugin code `genPrivateHandler`.
		* @param {string} action Type of handler to generate. `filter` will generate a dynamic query action, `log` will log the output to a console and
		* everything else will assume that a function named by the `action` propery is defined on the source plugin.
		* @param {BIVisual} sourceVis Source visualisation containing the interaction.
		* @param {BIVisual} targetVis Target visualisation affected by the interaction.
		* @param {object} passCols Object with a property for each column available to the interaction. These properties are booleans indicating whether
		* the column should be included in the filter.
		* @param {scope} scope Angular scope to pass to the filter handler so that interactions can be refreshed once the visualisation is re-rendered.
	*/
	insights.generateHandler = function(action, sourceVis, targetVis, passCols, scope) {
		switch (action) { // Switch for general actions that apply to multiple/all plugins
			case('filter'):
				return genFilterHandler(sourceVis, targetVis, passCols, scope);
				break;
			case ('log'):
				return function(event, output) { console.log(output); };
				break;
			default:
				// Assumes a function local to the plugin
				return genPrivateHandler(action, sourceVis, targetVis, passCols);
				break;
		}
	};

	/** Generate a handler to filter queries */
	function genFilterHandler(sourceVis, targetVis, passCols, scope) {
		return function(event, output) {
			output = formatOutput(output, passCols, targetVis); // Format output object
			if (output.length > 0) { // If criteria exists to pass
				targetVis.Refresh = insights.updateFilters(output, targetVis, true);
				targetVis.render(scope);
			}
		}
	}

	/**
		* Update or add filters on a visualisation using an interaction output object. Matching is done using the code of the column.
		* @param {object[]} colArray Array of objects produced by the interaction (`rmvpp.createTrigger`). This has a `BIColumn` object, the
		* visualisation configuration and and column map IDs for the source and target columns.
		* @param {BIVisual} targetVis Visualisation that should have its filters updated.
		* @param {boolean} global Will apply to the `Global` property of the `BIFilter` object created.
	*/
	insights.updateFilters = function(colArray, targetVis, global) {
		var updated = false;
		colArray.forEach(function(colMap) {
			var col = colMap.col;
			var filter = new obiee.BIFilter(col, colMap.values, 'in', col.SubjectArea, global);

			targetVis.Query = obiee.applyToColumnSets(targetVis.Query, targetVis.Plugin, function(query) {

				// Don't filter queries that don't match the subject area
				if (query.SubjectArea == filter.SubjectArea) {
					var filterFound = obiee.replaceFilter(query.Filters, filter);
					if (filterFound == true) {
						updated = true;
					} else if (!filterFound && filterFound != 'protected') {
						updated = true;
						query.Filters.push(filter);
					}
				}
				return query;
			});
		});
		return updated;
	};

	/**
		* Generate an drill handler based on the source and target paths and the action type. This is equivalent to the generic interaction
		* framework in terms of plugin definition. The inner workings of the filter application is different as it applies to a full dashboard.
		* Emits the `drillToReport` Angular event which is listened to by the dashboard in order to load the new page.
		* @param {BIDrilldown} drill Contains all of the information necessary to perform the action.
		* @param {scope} scope Angular scope used to emit the drill event.
	*/
	insights.generateDrillHandler = function(drill, scope) {
		var sourcePath = drill.SourcePath, drillPath = drill.DrillPath, crumbs = drill.Breadcrumbs;
		var passCols = drill.Columns, sourceVis = drill.SourceVis;

		return function(event, output) {
			output = formatOutput(output, passCols);

			// Add prompted filters from the source visualisation
			var globalFilters = drill.SourceVis.Query.Filters.filter(function(f) {
				return f.Global;
			}); // Get prompted filters

			// Match output structure
			globalFilters.forEach(function(f) {
				// Check if this column is already being sent
				if($.inArray(f.Column.Code, output.map(function(o) { return o.col.Code; })) == -1) {
					output.push({
						col: f.Column,
						values: f.Value,
						op: f.Operator,
						config: undefined,
						sourceId: undefined,
						targetId: undefined,
						global: true
					});
				}
			});

			var breadcrumb = new obiee.BIBreadcrumb(sourcePath, drillPath, output);
			crumbs.push(breadcrumb);

			if (scope)
				scope.$emit('drillToReport', drillPath, crumbs);
		}
	}

	/** Generate a handler for a private action on a plugin
		Assumes that the target plugin has an overloaded function with the action ID */
	function genPrivateHandler(action, sourceVis, targetVis, passCols) {
		var container;
		if (targetVis.Container)
			container = targetVis.Container.length ? targetVis.Container[0] : targetVis.Container;
		return function(event, output) {
			output = formatOutput(output, passCols, targetVis); // Format output object
			if (output.length > 0) {
				rmvpp.Plugins[targetVis.Plugin][action](output, container);
			}
		}
	}

	/** Formats output object to support passing multiple values from actions. */
	function formatOutput(output, passCols, targetVis) {

		output = output.filter(function(d) {
			return passCols[d.id];
		});

		var criteria = d3.set(output.map(function(d) { return d.id; })).values(); // Get unique criteria IDs

		// Handle multiple values for a single criteria
		var refactorOutput = [];
		criteria.forEach(function(c) { // Reform output objects to use array of values
			var criterion = output.filter(function(d) { return d.id == c; });
			var values = criterion
				.filter(function(d) { return d.value; })
				.map(function(d) { return d.value; });

			targetVis = targetVis || {};

			// Set target ID property, the property in the target column map that matches the input column code
			var targetID;
			obiee.applyToColumnMap(targetVis.ColumnMap, function(col, colID) {
				if (col.Code == criterion[0].col.Code)
					targetID = colID;
			});

			if (values.length > 0) {
				refactorOutput.push({
					'sourceId' : c,
					'targetId' : targetID,
					'col' : criterion[0].col,
					'values' : values,
					'config' : targetVis.Config,
					'columnMap' : targetVis.ColumnMap
				});
			}
		});
		output = refactorOutput;
		return output;
	}

	/**
		* Update dashboard prompt values with values interaction output from a drill action.
		* Passes operator if the input came from a dashboard prompt, or sets to equal/in if from a visualisation interaction.
		* @param {object[]} Array of objects produced by the interaction (`rmvpp.createTrigger`). This has a `BIColumn` object, the
		* visualisation configuration and and column map IDs for the source and target columns.
		* @param {BIPrompt} Dashboard prompt object to update.
	*/
	insights.updatePrompt = function (colArray, biPrompt) {
		colArray.forEach(function(colMap) {
			if (!$.isEmptyObject(biPrompt)) {
				biPrompt.Filters.forEach(function (filter) {
					if (colMap.col.Code == filter.Column.Code) {
						var dv = {
							ValueType : 'value',
							Value: colMap.values
						}
						filter.Operator = colMap.op ? colMap.op : 'in';
						filter.PromptOptions.DefaultValues = [dv];
					}
				});
			}
		});
	}

	/* ------ END OF INTERACTION HANDLER FUNCTIONS ------ */

	/* ------ UI FUNCTIONS ------ */

	insights.getFonts = function() {
		$.ajax({
			url: '/insights/icons/icons.json',
			type: "GET",
			dataType: "json",
			contentType: "text/json"
		}).done(function(response) {
			console.log(response);
		}).fail(function(jqXHR, textStatus, errorThrown) {
			console.log(jqXHR, textStatus, errorThrown);
		});
	}

	/* ------ END OF UI FUNCTIONS ------ */

	/* ------ DRAG, DROP AND RESIZE FUNCTIONS ------ */

	/**
		* Contains functions to be used with [InteractJS](http://interactjs.io/) for UI dragging and dropping. Each
		* function takes a mouse event as the only argument.
		* @example

// Basic movement
interact(element[0]).draggable({
	onmove: insights.drag.basic,
	onend: insights.drag.snapBack
});

// Dropping onto another element
interact(element[0]).dropzone({
	accept: '.dragColumn', // Only accept elements matching this CSS selector
	overlap: 'pointer', // Threshold to determine drop
	ondragenter: insights.drag.enter,
	ondragleave: insights.drag.leave,
	ondrop: dropFunction, // Custom function to execute on element drop
	ondropdeactivate: insights.drag.dropDisable
});

		* @property {function} drag.basic Allows element to be dragged and dropped.
		* @property {function} drag.column Only allows dragging if the column object is defined and has a code.
		* @property {function} drag.withScroll Same as `drag.basic` but compensates for dragging in a scrollable window.
		* @property {function} drag.snapBack End function which sends the element back to its original location.
		* @property {function} drag.enter Adds `dropTarget` class to the element when entering a valid drop zone.
		* @property {function} drag.leave Removes the `dropTarget` class when leaving the drop zone.
		* @property {function} drag.dropDisable Removes the `dropTarget` class when deactivating the drop zone.
	*/
	insights.drag = {};

	/** Basic dragging movement. */
	insights.drag.basic = function(event) {
		var target = event.target;

		// Keep the dragged position in the data-x/data-y attributes
		x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
		y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

		// Translate the element
		target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

		// Update the position attributes
		target.setAttribute('data-x', x);
		target.setAttribute('data-y', y);
	}

	/** Drags column only if a column object is defined and has a Code. */
	insights.drag.column = function(event) {
		var elemData = $(event.target).data();
		if (elemData.column) {
			if (elemData.column.Code) {
				var target = event.target;

				// Keep the dragged position in the data-x/data-y attributes
				x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
				y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

				// Translate the element
				target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

				// Update the position attributes
				target.setAttribute('data-x', x);
				target.setAttribute('data-y', y);
			}
		}

	}

	/** Drag column function which handles scroll bars on the left pane. */
	insights.drag.withScroll = function(event) {
		var panel = $(event.target).parents('.scrollContainer'); // Find the panel parent element with scroll defined on it
		var scroll = panel.scrollTop();
		var origHeight = panel.height();
		panel.css('overflow', 'visible');
		if (scroll > 0)
			panel.css('margin-top', -1 * scroll + 'px').height(origHeight+scroll);
		var target = event.target,
		// Keep the dragged position in the data-x/data-y attributes
		x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
		y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

		// Translate the element
		target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

		// Update the position attributes
		target.setAttribute('data-x', x);
		target.setAttribute('data-y', y);
	}

	/** Snap back to place when finished moving. */
	insights.drag.snapBack = function(event) {
		var panel = $(event.target).parents('.scrollContainer'); // Find the panel parent element with scroll defined on it
		panel.css('overflow', 'auto').css('margin-top', '0px').css('height', '100%');
		event.target.style.webkitTransform = event.target.style.transform = "";
		event.target.removeAttribute('data-x');
		event.target.removeAttribute('data-y');
	}

	/** Feedback the possibility of a drop event. */
	insights.drag.enter = function(event) {
		event.target.classList.add('dropTarget');
		if ($(event.target).hasClass('md-dark-theme')) {
			d3.select(event.target).transition().style('background-color', '#0B93E0');
		}
	}

	/** Remove the drop feedback style. */
	insights.drag.leave = function(event) {
		event.target.classList.remove('dropTarget');
		if ($(event.target).hasClass('md-dark-theme')) {
			d3.select(event.target).transition().style('background-color', 'rgb(43,43,43)');
		}
	}

	/** Remove the drop feedback style. */
	insights.drag.dropDisable = function(event) {
		event.target.classList.remove('dropTarget');
		if ($(event.target).hasClass('md-dark-theme')) {
			d3.select(event.target).transition().style('background-color', 'rgb(43,43,43)');
		}
	}

	/* ------ END OF DRAG, DROP AND RESIZE FUNCTIONS ------ */

	/* ------ PRINTING FUNCTIONS ------ */

	/**
		* Converts a complete dashboard to a canvas element and then exports to either `PNG` or `PDF` format.
		* Works by walking through the DOM tree of the element and converts HTML using [`html2canvas`](https://html2canvas.hertzen.com)
		* and SVG using [FabricJS](http://fabricjs.com/). Leaflet maps are rendered similarly but require the container to have the class
		* `print-as-map` attached. Note that map exporting is unreliable, mainly due to the dynamic fetching of the tile layer.
		* The class `do-not-print` can be added to any element on a plugin to prevent it from being exported. CSS attributes must be applied
		* to SVG elements as attributes for the export to work, and so functions `applySVGCSS` and `revertSVGCSS` are provided.
		* Finally, the canvases for each visualisation are stitched together using the visualisation X and Y coordinates and are
		* are exported using [FileSaverJS](https://github.com/eligrey/FileSaver.js/).
		* @param {DOM} dbElem HTML element container for the dashboard that needs printing.
		* @param {string} filename Name of the file to save to.
		* @param {string} type Type of file to export, accepts either `png` or `pdf`.
	*/
	insights.printDB = function(db, filename, type, callback){
		type = type || 'png';
		var dbElem = $(db.Container);
		var visArray = $(dbElem).find('.visualisation');
		var dfdArray = [], canvasArray = [];

		applySVGCSS(); // Apply CSS as attributes for print function

		// Loop over visualisations
		$(visArray).each(function(i) {
			var canvasID = 'printCanvas-' + i;
			createParentCanvas(this, canvasID);
			dfdArray.push( // Create visualisation canvases asynchronously
				$.when(printElement($(this), canvasID, 0)).done(function() {
					var canvas = drawVisToMaster(canvasID);
					canvasArray.push(canvas);
				})
			);
		});

		// When all rendered, stitch them together
		$.when.apply($, dfdArray).done(function() {
			// Get overall dashboard size
			dbHeight = db.getHeight();
			dbWidth = db.getWidth();

			createParentCanvas(canvasArray[0], 'printCanvas', dbHeight, dbWidth); // Create master canvas

			var masterCanvas = new fabric.StaticCanvas('printCanvas');
			masterCanvas.setBackgroundColor('#FFFFFF');

			// If a designed canvas exists
			var designerDFD = new $.Deferred();
			if (db.Canvas.JSON) {
				masterCanvas.loadFromJSON(db.Canvas.JSON, function() {
					masterCanvas.renderAll();
					designerDFD.resolve();
				});
			} else {
				designerDFD.resolve();
			}

			// Wait till the designed canvas has finished loading
			designerDFD.done(function() {
				var ctx = masterCanvas.lowerCanvasEl.getContext('2d');

				// Loop through visualisation canvases
				$(canvasArray).each(function() {
					var order = +$(this).attr('id').split('printCanvas-')[1];
					var canvas = document.getElementById($(this).attr('id'));
					var x = d3.max([0, +$(visArray[order]).attr('data-x')]);
					var y = d3.max([0, +$(visArray[order]).attr('data-y')]);

					ctx.drawImage(canvas, x, y); // Draw to master at correct location
					$(canvas).remove();
				});

				revertSVGCSS();
				switch(type) {
					case 'png':
						saveAsPNG(masterCanvas.lowerCanvasEl, filename + '.png'); // Save as PNG
						break;
					case 'pdf':
						saveAsPDF(masterCanvas.lowerCanvasEl, filename + '.pdf'); // Save as PDF
						break;
				}
				if (callback) {
					callback();
				}
			})
		});
	}

	/**
		* Function to convert an HTML/SVG element to a canvas and export as a `PNG` or `PDF`.
		* Works by walking through the DOM tree of the element and converts HTML using [`html2canvas`](https://html2canvas.hertzen.com)
		* and SVG using [FabricJS](http://fabricjs.com/). Leaflet maps are rendered similarly but require the container to have the class
		* `print-as-map` attached. Note that map exporting is unreliable, mainly due to the dynamic fetching of the tile layer.
		* Additionally, the [Leaflet map object](http://leafletjs.com/reference.html#map-get-methods) should be attached to this element
		* as a jQuery data attachment, with the property `mapObject`. E.g. `$(mapContainer).data({ 'mapObject' : map })`
		* The class `do-not-print` can be added to any element on a plugin to prevent it from being exported. CSS attributes must be applied
		* to SVG elements as attributes for the export to work, and so functions `applySVGCSS` and `revertSVGCSS` are provided.
		* Finally, the canvas is exported using [FileSaverJS](https://github.com/eligrey/FileSaver.js/).
		* @param {DOM} elem HTML element to convert.
		* @param {string} filename Name of the file to save to.
		* @param {string} type Type of file to export, accepts either `png` or `pdf`.
	*/
	insights.printHTML = function (elem, filename, type) {
		type = type || 'png';
		applySVGCSS();
		$('#printCanvas').remove(); // Remove printing canvas
		createParentCanvas(elem, 'printCanvas') // Add new canvas

		// When all asynchronous calls resolved, print the element
		$.when(printElement(elem, 'printCanvas', 0)).done(function() {
			var canvas = drawVisToMaster('printCanvas');
			revertSVGCSS();
			switch(type) {
				case 'png':
					saveAsPNG(canvas, filename + '.png'); // Save as PNG
					break;
				case 'pdf':
					saveAsPDF(canvas, filename + '.pdf'); // Save as PDF
					break;
			}
		});
	}

	// Create empty, parent canvas element
	function createParentCanvas(elem, id, height, width) {
		height = height || 0, width = width || 0;
		$(elem).parent().append($('<canvas id="' + id +'"></canvas>')
			.attr('height', height)
			.attr('width', width)
		);
	}

	// Save as PNG
	function saveAsPNG(canvas, filename) {
		canvas.toBlob(function(blob) {
			saveAs(blob, filename);
			$(canvas).remove();
		});
	}

	// Save as PDF
	function saveAsPDF(canvas, filename) {
		// Change completely transparent pixels to white
		var ctx = canvas.getContext('2d');
		var imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
		var data=imgData.data;
		for(var i=0;i<data.length;i+=4){
			if(data[i+3] == 0){
				data[i] = 255 - data[i];
				data[i+1] = 255 - data[i+1];
				data[i+2] = 255 - data[i+2];
				data[i+3] = 255 - data[i+3];
			}
		}
		ctx.putImageData(imgData,0,0);

		var img = canvas.toDataURL("image/jpeg"); // Rendering PDF as PNG is unnecessarily intensive
		var width, height, ratio = $(canvas).width()/$(canvas).height();

		// Scale to page size
		if ($(canvas).width() > 800 || $(canvas).height() > 500) {
			if (ratio < 1.6) { // 1.5 is the ratio of an A4 sheet of paper
				height = 500; // A4 height
				width = height * ratio;
			} else {
				width = 800; // A4 width
				height = width / ratio;
			}
		} else {
			width = $(canvas).width();
			height = $(canvas).height();
		}

		var doc = new jsPDF('landscape', 'pt', 'A4');

		doc.addImage(img, 'JPEG', 20, 20, width, height);
		doc.save(filename);
		$(canvas).remove();
	}

	// Apply CSS as attributes for SVG elements for printing only
	function applySVGCSS() {
		var basic = $('.bar-chart, .hbar-chart, .scatter-chart, .line-chart, .pie-chart, .sunburst-chart');

		basic.find('text').css({
			'fill': '#333',
			'font-size': '10px',
			'font-family': 'sans-serif'
		});

		basic.find('.axis .label').css({
			'font-family': "'Open Sans', Arial",
			'font-size': '12px',
			'font-weight': 'bold'
		});

		basic.find('.axis path, .axis line').css({
			'fill': 'none',
			'stroke': '#666',
			'shape-rendering': 'crispEdges'
		});

		basic.find('.legend text.title').css({
			'font-weight': 'bold',
			'text-anchor': 'end'
		});

		// The following should be removed/reverted after print
		basic.find('.zoomOut').hide();
	}

	// Revert any applied CSS for printing
	function revertSVGCSS() {
		$('.tempCanvas').remove(); // Remove temporary canvases
		$('.canvas-container').each(function() {
			if ($(this).children('.designLayer').length == 0)
				$(this).remove();
		})
		$('.zoomOut').show();
	}

	// Prints a DOM tree, recursively checking for SVG elements
	function printElement(elem, canvasID, i) {
		var mainDFD = $.Deferred();
		var dfdArray = []; // Use array of deferred objects to handle multiple levels

		// Loop over children
		elem.children().each(function() {
			if(!d3.select(this).classed('do-not-print')) {
				if ($(this).hasClass('print-as-map') || $(this).hasClass('print-as-html')) {
					dfdArray.push($.when(createCanvas($(this), canvasID, i)));
				} else if ($(this).find('svg').length > 0) {
					dfdArray.push(
						$.when(printElement($(this), canvasID, i+1)) // Recurse if SVG found
					);
				} else {
					dfdArray.push($.when(createCanvas($(this), canvasID, i))); // Create temporary canvases to build into full image
				}
			}
		});

		// Resolve when all recurses complete
		$.when.apply($, dfdArray).done(function() {
			mainDFD.resolve();
		});

		return mainDFD.promise();
	}

	// Create canvas elements from Div and SVG elements
	function createCanvas(elem, masterCanvasID, i) {
		var canvasDFD = $.Deferred();
		if (elem.hasClass('print-as-map')) { // Handle Leaflet maps
			var canvasDFDArray = [$.Deferred(), $.Deferred()];

			var d = new Date();
			var seconds = d.getTime() / 1000;

			// Force the tiles to avoid the cache
			elem.find('.leaflet-tile').each(function() {
				$(this).attr('src', $(this).attr('src') + '?' + seconds);
			});

			// Special print function for map tile images using proxy
			html2canvas(elem[0], {
				noCache: true,
				useCORS: true,
				logging: false,
				timeout: 1000,
				onrendered: function(tempCanvas) {
					$(tempCanvas)
						.attr('id', 'tempMapCanvas1-' + i + '-' + masterCanvasID)
						.attr('canvas-id', i)
						.addClass('tempMapCanvas')
						.addClass(masterCanvasID);
					$('#'+masterCanvasID).parent().append(tempCanvas);
					canvasDFDArray[0].resolve();
				}
			});

			$('#'+masterCanvasID).parent().append('<canvas class="tempMapCanvas ' + masterCanvasID + '" canvas-id="' + i + '" id="tempMapCanvas0-' + i + '-' + masterCanvasID + '"></canvas>');
			var tempCanvas = new fabric.Canvas('tempMapCanvas0-' + i + '-' + masterCanvasID, {
				 height: elem.height(),
				 width: elem.width()
			});

			var svgElem = elem.find('svg').clone();
			svgElem.find('.do-not-print').remove();

			if (svgElem.length > 0) { // Processes D3 SVG layers on the map
				var serializer = new XMLSerializer();
				var svg = serializer.serializeToString(svgElem[0]);

				// Get the translation offset from the Leaflet map object
				function getMapTranslation(elem) {
					var translate = { x: 0, y: 0 };
					if (elem.data().hasOwnProperty('mapObject')) {
						var map = elem.data().mapObject;
						translate.x = map.getPixelOrigin().x - map.getPixelBounds().min.x;
						translate.y = map.getPixelOrigin().y - map.getPixelBounds().min.y;

						translate.x += +elem.find('svg').css('margin-left').replace('px', '') || 0;
						translate.y += +elem.find('svg').css('margin-top').replace('px','') || 0;
					}
					return translate;
				}

				var mapOffset = getMapTranslation(elem);
				fabric.loadSVGFromString(svg, function(objects, options) {
					var obj = fabric.util.groupSVGElements(objects, options);

					// Alter SVG object offsets for different map types for correct positioning
					if (obj.width < elem.width()) { // Targets bubbles/clusters
						obj.paths.forEach(function(p) {
							if (p.transformMatrix) {
								p.transformMatrix[4] += mapOffset.x;
								p.transformMatrix[5] += mapOffset.y;
							}
						});
					} else { // Choropleths
						obj.paths.forEach(function(p) {
							if (p.transformMatrix) {
								p.transformMatrix[4] = mapOffset.x;
								p.transformMatrix[5] = mapOffset.y;
							}
						});
					}

					tempCanvas.add(obj).renderAll();
					canvasDFDArray[1].resolve();
				});
			} else { // Catcehs maps without a D3 layer, e.g. the heatmap
				canvasDFDArray[1].resolve();
			}

			$.when.apply($, canvasDFDArray).done(function() {
				$('#'+masterCanvasID).parent().append('<canvas class="tempCanvas ' + masterCanvasID + ' lower-canvas" canvas-id="' + i + '" id="tempCanvas-' + i + '-' + masterCanvasID + '"></canvas>');

				$('#tempCanvas-' + i + '-' + masterCanvasID).attr({width: elem.width(), height: elem.height()});

				var can1 = document.getElementById('tempMapCanvas1-' + i + '-' + masterCanvasID);
				var can2 = document.getElementById('tempMapCanvas0-' + i + '-' + masterCanvasID);
				var can3 = document.getElementById('tempCanvas-' + i + '-' + masterCanvasID);
				var ctx3 = can3.getContext('2d');

				var svgElem = elem.find('svg'), left = 0, top = 0;

				ctx3.drawImage(can1, 0, 0);

				if (svgElem.length > 0) {
					left = +elem.find('svg').css('margin-left').replace('px', '') || 0;
					top = +elem.find('svg').css('margin-top').replace('px','') || 0;
				}

				ctx3.drawImage(can2, 0, 0);
				$(can1).remove(); $(can2).remove();
				canvasDFD.resolve();
			});
		} else if (elem.prop('nodeName').toLowerCase() != 'svg') { // Render HTML elements
			if (elem.css('display') != 'none') { // Don't render if not displayed
				// Convert HTML to canvas using html2canvas
				html2canvas(elem[0], {
					onrendered: function(tempCanvas) {
						$(tempCanvas)
							.attr('id', 'tempCanvas-' + i + '-' + masterCanvasID)
							.attr('canvas-id', i)
							.addClass('tempCanvas lower-canvas')
							.addClass(masterCanvasID);
						$('#'+masterCanvasID).parent().append(tempCanvas);
						canvasDFD.resolve();
					}
				});
			} else
				canvasDFD.resolve();
		} else { // Render SVG elements
			$('#'+masterCanvasID).parent().append('<canvas class="tempCanvas ' + masterCanvasID + '" canvas-id="' + i + '" id="tempCanvas-' + i + '-' + masterCanvasID + '"></canvas>');
			var tempCanvas = new fabric.Canvas('tempCanvas-' + i + '-' + masterCanvasID, {
				 backgroundColor: 'rgb(255, 255, 255)',
				 height: elem.height(),
				 width: elem.width()
			});

			var serializer = new XMLSerializer();
			var svg = serializer.serializeToString(elem[0]);

			fabric.loadSVGFromString(svg, function(objects, options) {
				var obj = fabric.util.groupSVGElements(objects, options);
				tempCanvas.add(obj).renderAll();
				canvasDFD.resolve();
			});
		}
		return canvasDFD.promise();
	}

	// Assemble master canvas for a single visualisation from the temporary canvases made by createCanvas
	function drawVisToMaster(masterCanvasID) {
		var canvasArray = $('.tempCanvas.lower-canvas.' + masterCanvasID + '[id]');
		canvasArray = canvasArray.sort(function(a, b) { return +$(a).attr('canvas-id')-$(b).attr('canvas-id'); }) // Sort element array

		var width = d3.max(canvasArray.map(function(d) { return +$(this).attr('width'); }));
		var height = d3.sum(canvasArray.map(function(d) { return +$(this).attr('height'); }));

		var masterCanvas = document.getElementById(masterCanvasID);
		$(masterCanvas).attr('width', width).attr('height', height);
		var ctx = masterCanvas.getContext('2d');

		var height = 0;
		canvasArray.each(function(i) {
			var tempCanvas = document.getElementById($(this).attr('id'));

			ctx.drawImage(tempCanvas, 0, height);
		});

		return masterCanvas;
	}

	/* ------ END OF PRINTING FUNCTIONS ------ */

	/* ------ PAGE INITIALISATION ------ */

	/** Indicates whether page is in edit or view mode and should accept Angular scope.
	Can be used to optimise plugin code that is unnecessary when only viewing. */
	insights.Edit = false;

	/** Apply any application changes. Assumes the application scope has been assigned to `insights.Edit`. */
	insights.applyChanges = function() {
		if (insights.Edit) { insights.Edit.$apply(); }
	};

	/* ------ END OF PAGE INITIALISATION ------ */

	return insights;
}(insights || {}));
