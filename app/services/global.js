// Material theme colours
app.config(function($mdThemingProvider, $mdDateLocaleProvider) {
	var insights = $mdThemingProvider.extendPalette('blue', {
		'500': '#5484F1'
	});

	var insightsBright = $mdThemingProvider.extendPalette('light-blue', {
		'500': '#0B93E0'
	});

	var insightsDark = $mdThemingProvider.extendPalette('grey', {
		'800': '#333439',
		'900' :'#2B2B2B'
	});

	$mdThemingProvider.definePalette('insights', insights);
	$mdThemingProvider.definePalette('insightsDark', insightsDark);
	$mdThemingProvider.definePalette('insightsBright', insightsBright);

	$mdThemingProvider.theme('dark')
		.primaryPalette('insightsBright', {
			'hue-1' : 'A100'
		})
		.accentPalette('green', {
			default: '500'
		})
		.warnPalette('red', {
			default: '600'
		})
		.backgroundPalette('insightsDark')
		.dark()

 	$mdThemingProvider.theme('default')
		.primaryPalette('insights', {
			'hue-1' : 'A100'
		})
		.accentPalette('green', {
			default: '500'
		})
		.warnPalette('red', {
			default: '600'
		});

	$mdDateLocaleProvider.formatDate = function(date) {
		var out = null;
		if (date)
			out = rmvpp.locales['GB'].timeFormat('%d/%m/%Y')(date);
		return out;
	};
});

// UI configuration parameters
app.factory('UIConfig', function() {
	var UIConfig = {
		Buttons: InsightsConfig.UI.Buttons
	};
	return UIConfig;
});

// Information to be shared between controllers
app.factory('Global', ['ModalService', 'UIConfig', '$timeout', '$window', function(ModalService, UIConfig, $timeout, $window) {
	var tooltip = new rmvpp.Tooltip($('body')[0]); // Create tooltip object
	var navigate = function(link, colour) {
		Global.fadeOut(colour);
		setTimeout(function() { window.location.href = link; }, 250);
	}

	var genOverlay = function(colour) {
		if ($('.mask.overlay').length == 0) {
			colour = colour || '#ffffff';
			d3.selectAll('.mask.overlay').remove();
			d3.select('body').append('div').classed('mask', true).classed('overlay', true).style('background', colour);
		}
	}

	// Confirmation modal
	var confirmDialogue = function(successFunc, msg, width, errorFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/confirmModal.html",
			controller: "ConfirmModalController",
			inputs: { msg : msg, width: width}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out) {
					successFunc(out);
				} else {
					if (errorFunc)
						errorFunc();
				}
			});
		});
	}

	// Text modal
	var textDialogue = function(successFunc, msg, textVal) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/textModal.html",
			controller: "TextModalController",
			inputs: {
				msg : msg,
				textVal: textVal
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out)
					successFunc(out);
			});
		});
	}

	// Image modal
	var imageDialogue = function(successFunc, msg, imageVal) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/imageModal.html",
			controller: "ImageModalController",
			inputs: {
				msg : msg,
				imageVal: imageVal
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out)
					successFunc(out);
			});
		});
	}

	// Icon picker modal
	var iconPicker = function(icon, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/iconModal.html",
			controller: "IconModalController",
			inputs: { icon : icon }
		}).then(function(modal) {
			modal.close.then(function(icon) {
				if (icon)
					successFunc(icon);
			});
		});
	}

	// Map picker modal
	var mapPicker = function(map, name, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/mapModal.html",
			controller: "MapModalController",
			inputs: {
				map : map,
				name: name
			}
		}).then(function(modal) {
			modal.close.then(function(mapObj) {
				if (mapObj) {
					successFunc(mapObj.path, mapObj.name);
				}
			});
		});
	};

	// Map tile picker modal
	var mapTilePicker = function(tile, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/mapTileModal.html",
			controller: "MapTileModalController",
			inputs: {
				tile : tile
			}
		}).then(function(modal) {
			modal.close.then(function(tile) {
				if (tile) {
					successFunc(tile);
				}
			});
		});
	};

	// Function library
	var functionLibrary = function(successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/functionsModal.html",
			controller: "FunctionsModalController"
		}).then(function(modal) {
			modal.close.then(function(func) {
				successFunc(func);
			});
		});
	}

	// Colour Palette editing modal
	var paletteEditor = function(colours, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/paletteModal.html",
			controller: "PaletteModalController",
			inputs: { colours : colours }
		}).then(function(modal) {
			modal.close.then(function(colours) {
				if (colours)
					successFunc(colours);
			});
		});
	}

	// Publish dashboard modal
	var publishDB = function(successFunc, path) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/publishDBModal.html",
			controller: "PublishDBModalController",
			inputs: { path : path }
		}).then(function(modal) {
			modal.close.then(function(done) {
				if (done)
					successFunc();
			});
		});
	}

	// Webcat explorer modal
	var webcatExplorer = function(start, successFunc, saveMode, forceOpen, includeACL) {
		// Check if need to open modal
		obiee.fetchWebcatObjects(start, function(output) {
			open(false, includeACL);
		}, function(err) {
			if (((err.indexOf('Folder expected:') > -1) || (saveMode && err.indexOf('Path not found') > -1)) && !forceOpen) {
				successFunc(start);
			} else {
				if (forceOpen)
					open(true, includeACL);
				else
					open(false, includeACL);
			}
		});

		// Open modal for catalogue explorer
		function open(folderUp, includeACL) {
			ModalService.showModal({
				templateUrl: "/insights/app/directives/templates/modals/webcatModal.html",
				controller: "WebcatModalController",
				inputs: {
					start: start,
					saveMode: saveMode,
					folderUp: folderUp,
					includeACL: includeACL
				}
			}).then(function(modal) {
				modal.close.then(function(path) {
					angular.element($window).off('keydown');
					if (path) {
						successFunc(path);
					}
				});
			});
		}
	}

	// Edit web catalogue permissions modal
	var editPermissions = function(item, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editPermsModal.html",
			controller: "EditPermsModalController",
			inputs: { item : item } // Web catalogue item
		}).then(function(modal) {
			modal.close.then(function(done) {
				if (done)
					successFunc();
			});
		});
	}

	// Advanced filter modal
	var advancedFilter = function(startFilter, valueTypes, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/filterModal.html",
			controller: "FilterModalController",
			inputs: {
				filter: startFilter,
				extraTypes: valueTypes
			}
		}).then(function(modal) {
			modal.close.then(function(filter) {
				successFunc(filter)
			});
		});
	}

	// Dashboard prompt edit modal
	var editPromptFilter = function(startFilter, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/modals/promptFilterModal.html",
			controller: "PromptFilterModalController",
			inputs: {
				filter: startFilter
			}
		}).then(function(modal) {
			modal.close.then(function(filter) {
				successFunc(filter);
			});
		});
	}

	// Edit conditional formatting rule
	var editCondFormat = function(cf, visColumns, plugin, successFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editCFModal.html",
			controller: "EditCFModalController",
			inputs: {
				cf : cf,
				visColumns : visColumns,
				plugin: plugin
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out)
					successFunc(out);
			});
		});
	}

	// Edit interaction
	var editInteraction = function(interact, visuals, successFunc, cancelFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editInteractModal.html",
			controller: "EditInteractModalController",
			inputs: {
				interact : interact,
				visuals : visuals,
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out) {
					successFunc(out);
				} else if (cancelFunc){
					cancelFunc();
				}
			});
		});
	}

	// Edit drilldown
	var editDrilldown = function(drill, visuals, successFunc, cancelFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editDrillModal.html",
			controller: "EditDrillModalController",
			inputs: {
				drill : drill,
				visuals : visuals,
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out) {
					successFunc(out);
				} else if (cancelFunc) {
					cancelFunc();
				}
			});
		});
	}

	// Edit Column Selector modal
	var editColSelector = function(cs, visuals, successFunc, cancelFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editCSModal.html",
			controller: "EditCSModalController",
			inputs: {
				cs : cs,
				visuals : visuals,
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out) {
					successFunc(out);
				} else if (cancelFunc) {
					cancelFunc();
				}
			});
		});
	}

	// Edit Visual Selector modal
	var editVisSelector = function(vs, visuals, successFunc, cancelFunc) {
		ModalService.showModal({
			templateUrl: "/insights/app/directives/templates/edit/editVSModal.html",
			controller: "EditVSModalController",
			inputs: {
				vs : vs,
				visuals : visuals,
			}
		}).then(function(modal) {
			modal.close.then(function(out) {
				if (out) {
					successFunc(out);
				} else if (cancelFunc) {
					cancelFunc();
				}
			});
		});
	}

	var Global = {
		webcatPath: '/', // Default path
		tooltip : tooltip ,
		navigate: navigate,
		loadingDefaults: { msg: 'Loading...', opacity: 0.75, background: 'black', colour: 'white' },
		loading: {show: false, msg: 'Loading...', opacity: 0.75, background: 'black', colour: 'white'},
		loadingOn: function(msg, colour, opacity, background, scope) {
			Global.loading.msg = msg || Global.loadingDefaults.msg;
			Global.loading.colour = colour || Global.loadingDefaults.colour;
			Global.loading.opacity = opacity || Global.loadingDefaults.opacity;
			Global.loading.background = background || Global.loadingDefaults.background;
			Global.loading.show = true;

			if (scope && !scope.$$phase) { // Apply scope if passed and not in digest
				$timeout(function() { scope.$apply() }); // Timeout prevents digest errors
			}
		},
		loadingOff: function(scope) {
			Global.loading.show = false;
			if (scope && !scope.$$phase) { // Apply scope if passed and not in digest
				$timeout(function() { scope.$apply() }); // Timeout prevents digest errors
			}
		},
		maskScreen: function(colour, loading) {
			genOverlay(colour);
			if (loading)
				Global.loadingOn('',  '#2B2B2B', 1, 'white');
			d3.select('.mask.overlay').style('opacity', 1);
		},
		fadeIn: function(colour) { // Fade mask out/fade screen in
			genOverlay(colour)
			Global.loadingOff();
			d3.select('.mask.overlay').transition().duration(500).style('opacity', 0).remove();
		},
		fadeOut: function(colour) { // Fade mask out/fade screen in
			genOverlay(colour)
			d3.select('.mask.overlay').transition().duration(500).style('opacity', 1);
		},
		subjectAreas: [],
		webcatExplorer: webcatExplorer,
		editPermissions: editPermissions,
		advancedFilter: advancedFilter,
		editPromptFilter: editPromptFilter,
		textDialogue: textDialogue,
		imageDialogue: imageDialogue,
		confirmDialogue: confirmDialogue,
		publishDB: publishDB,
		iconPicker: iconPicker,
		mapPicker: mapPicker,
		mapTilePicker: mapTilePicker,
		paletteEditor: paletteEditor,
		functionLibrary: functionLibrary,
		editCondFormat: editCondFormat,
		editInteraction: editInteraction,
		editDrilldown: editDrilldown,
		editColSelector: editColSelector,
		editVisSelector: editVisSelector
	};
	return Global;
}]);

// Service for retrieving and manipulating BI metadata
app.factory('Metadata', ['Global', function(Global) {
	var Metadata = {
		// Populate presentation table hierarchy
		popPresTables: function(sa, metadata, callback) {
			var sa = sa;
			if (sa) {
				if (!(sa in metadata)) {
					obiee.getTablesAndCols(sa, function(presObj) { // Otherwise call OBIEE
						metadata[sa] = presObj;
						Global.subjectArea = sa;
						Global.biMetadata = metadata;
						if (callback)
							callback();
					})
				} else {
					if (callback)
						callback();
				}
			}

		},
		// Add any custom columns from the visualisation to the presentation layer
		addCustomColumns: function(query,  metadata, callback) {
			query.Criteria.forEach(function(c) {
				if (!metadata[query.SubjectArea].AllColumns.hasOwnProperty(c.ID) && c.Table != 'RM-Sort') {
					metadata[query.SubjectArea].addColumn(c);
				}
			});

			if (callback) {
				callback();
			}
		},
		updateMetadata: function(scope, vis, metadata, callback) {
			obiee.applyToColumnSets(vis.Query, vis.Plugin, function(query, dataset) {
				if (query.SubjectArea in metadata) {
					Metadata.addCustomColumns(query, metadata, callback);
				} else {
					Metadata.popPresTables(query.SubjectArea, metadata, function() {
						Metadata.addCustomColumns(query, metadata, callback);
					});
				}
				return query;
			});
		}
	};
	return Metadata;
}]);

app.factory('Visuals', function() {
	var Visuals = {
		storeVis: function(vis, visArray) {
			vis.forEach(function(v) {
				var criteriaLength = []
				obiee.applyToColumnSets(v.Query, v.Plugin, function(item) {
					criteriaLength.push(item.Criteria.length);
					return item;
				});

				if ($.inArray(v, visArray) == -1 && criteriaLength.some(function(v) { return v > 0; })) {
					v.ID = visArray.length;
					v.Name = v.defaultName();
					v.resetName();
					visArray.push(v);
				}
			});
		},
		move: function(element, vis) {
			// Use jQuery UI instead of interact, mainly for resizing
			$(element[0]).draggable();
			$(element[0]).draggable('enable');
			element.css('position', 'relative');
		},
		disableMove: function(obj, element) {
			if ($(element[0]).draggable('instance'))
				$(element[0]).draggable('disable');

			var left = element.css('left'), vtop = element.css('top');
			function posVal(pos) {
				var val = 0;
				if (pos != 'auto') {
					val = /(.*?)px/.exec(pos)[1];
					val = +val;
				}
				return val;
			}

			// Set X and Y attributes based on distance moved
			obj.X = +obj.X + posVal(left)
			obj.Y = +obj.Y + posVal(vtop);
			element.css('position', 'static');
			element.css('left',''), element.css('top', '');
		},
		getVisByName: function(name, visArray) { // Gets visualisation from array by name
			return visArray.filter(function(v) {
				return v.Name == name;
			})[0];
		}
	};
	return Visuals;
});

// Can be used to filter angular objects
app.filter('presTableSearch', function() {
    return function(objs, search) {
		if (!search || !objs) return objs;
		var result = {};

		function checkHasCol(table, found) {
			var hasCol = found || false;
			angular.forEach(table.Columns, function(val, key) {
				if (val.Name.toLowerCase().indexOf(search.toLowerCase()) > -1)
					hasCol = true;
			});
			angular.forEach(table.Children, function(val, key) {
				hasCol = checkHasCol(val, hasCol);
			});
			return hasCol;
		}

		angular.forEach(objs, function(value, key) {
			if (objs[key].Type == 'Table') {
				if (checkHasCol(objs[key]))
					result[key] = value;
			} else if (objs[key]) {
				if (objs[key].Name.toLowerCase().indexOf(search.toLowerCase()) > -1) // Check name
					result[key] = value;
			}
		});
		return result;
    };
});

// Filters out any BIFilter objects with Global set to true
app.filter('noGlobalFilters', function() {
    return function(objs, search) {
		if (!objs) return objs;
		if (!$.isArray(objs)) return objs;

		var result = [];
		objs.forEach(function(filter) {
			if (!filter.Global)
				result.push(filter);
		});
		return result;
    };
});

// Search dashbaords by name and tag
app.filter('filterDBs', function() {
	return function(objs, search) {
		var result = [];
		objs.forEach(function(db) {
			var include = false;
			if (db.name.toLowerCase().indexOf(search.toLowerCase()) > -1) {
				include = true;
			}
			db.tags.forEach(function(tag) {
				if (tag.toLowerCase().indexOf(search.toLowerCase()) > -1)
					include = true;
			});
			if (include)
				result.push(db);
		});
		return result;
	};
});

// Search function library
app.filter('filterFunctions', function() {
	return function(objs, search) {
		if (!search || !objs) return objs;
		var result = {};

		function checkValue(val) {
			if (val && val.Name)
				return val.Name.toLowerCase().indexOf(search.toLowerCase()) > -1;
		}

		function checkChild(obj) {
			var keep = false;
			angular.forEach(obj, function(value, key) {
				if (checkValue(value))
					keep = true;
			});
			return keep;
		}

		angular.forEach(objs, function(value, key) {
			if (value.hasOwnProperty('expand')) { // Parent
				if (checkChild(value))
					result[key] = value;
			} else {
				if (checkValue(value)) {
					result[key] = value;
				}
			}
		});
		return result;
	};
});
