// Main controller for the visualisation builder
app.controller('visBuilder', function($scope, $timeout, $window, $mdToast, ModalService, UIConfig, Global, Metadata, Visuals, $mdDialog) {
	$scope.webcatPath = rmvpp.getQueryString('path') || Global.webcatPath; // Initial webcat path variable

	$scope.file = ''; // Dashboard title
	$scope.logoffBtn = UIConfig.Buttons.logoff;
	$scope.leftPaneWidth = 260, $scope.rightPaneWidth = 200;
	$scope.loading = Global.loading, $scope.panesShown = true;
	$scope.showOptions = true, $scope.showInteracts = false;
	$scope.loading = Global.loading;
	$scope.visTab = 'Column Mappings', $scope.intOption = 'Interactions';

	// Plugins
	$scope.plugins = rmvpp.getPlugins();
	$scope.plugin = 'table';

	// Dashboard variables
	$scope.db = new obiee.BIDashboardPage();
	$scope.editMode = false;

	$scope.dummy = function() {};

	$scope.test = function() {
		console.log($scope.db.Prompts.Filters[0].PromptOptions);
	}

	// Hide left and right panels
	$scope.hidePanes = function() {
		$scope.lastLeftPaneWidth = $scope.leftPaneWidth;
		$scope.lastRightPaneWidth = $scope.rightPaneWidth;
		$scope.leftPaneWidth = 60;
		$scope.rightPaneWidth = 0;
		$scope.panesShown = false;
	}

	// Show left and right panels
	$scope.showPanes = function() {
		$scope.leftPaneWidth = $scope.lastLeftPaneWidth;
		$scope.rightPaneWidth = $scope.lastRightPaneWidth;
		if (!$scope.designMode && $scope.rightPaneWidth == 0)
			$scope.rightPaneWidth = 200;
		$scope.panesShown = true;
	}

	// Switch to dashboard mode
	$scope.dashboardMode = false;
	$scope.switchDashboardMode = function(skipOpen) {
		$scope.dashboardMode = true;
		$scope.storeVis();

		if (!skipOpen) {
			$timeout(function() {
				$scope.$broadcast('refreshDB');
			})
		}
	}

	// Switch to visualisation mode
	$scope.switchVisMode = function() {
		if ($scope.designMode) {
			disableDesignEditor();
		}
		if (!$scope.panesShown) {
			$scope.showPanes();
		}
		$scope.editMode = false;
		$scope.dashboardMode = false;
	}

	// Go to the portal page
	$scope.home = function() {
		Global.navigate('/insights/app/states/portal');
	}

	// Sign out of OBIEE and go back to the login page
	$scope.logoff = function() {
		Global.loadingOn('Signing Out...', 'black', 1, 'white');
		obiee.logoff(function() {
			Global.navigate('/insights');
		});
	}

	// Automatically logout if no ID found
	if (!sessionStorage.obieeSessionId)
		Global.navigate('/insights');
	else {
		obiee.setRMPermissions(function() { // Set app permissions if not already set
			if (obiee.hasRMRole('create')) { // Wait for permissions to be fetched
				$scope.allowed = true;
				init();
			} else {
				Global.fadeIn();
			}
		}, function() { // Logout on error
			logoff();
		});
	}

	// Update column map parameters when the plugin changes
	$scope.$watch(function () { return $scope.plugin }, function (newVal, oldVal) {
		$scope.colmapParams = rmvpp.Plugins[$scope.plugin].columnMappingParameters;
		$scope.configParams = rmvpp.Plugins[$scope.plugin].configurationParameters;
	});

	// Subject Areas
	$scope.subjectAreas = [], $scope.subjectArea = '', $scope.metadata = {};

	// Iinitialisation function run on startup
	function init() {
		if (rmvpp.getQueryString('mode') == 'db') {
			$scope.switchDashboardMode(true);
		}

		if (rmvpp.getQueryString('path')) {
			$scope.openWebcat(true);
		}

		insights.Edit = $scope;
		Global.fadeIn();
		$scope.$apply();
	}

	// Updates left pane width globally upon resize
	$scope.updateLeftPaneWidth = function(e, ui) {
		$scope.leftPaneWidth = $(ui.element).width();
		$scope.$apply();
	}

	// Updates right pane width globally upon resize
	$scope.updateRightPaneWidth = function(e, ui) {
		$scope.rightPaneWidth = $(ui.element).width();
		$scope.$apply();
	}

	// Toggle options
	$scope.toggleOptions = function() {
		$scope.showOptions = !$scope.showOptions;
	}

	﻿// Add new columns
	$scope.editColumn = {
		show: false,
		config: false,
		column: {},
		newMode: true
	};

	// Open new column modal
	$scope.toggleNewColumn = function() {
		$scope.editColumn.column = new obiee.BIColumn('', '');
		$scope.editColumn.newMode = true;
		$scope.editColumn.show = !$scope.editColumn.show;
	}

	// Edit column dialogue
	$scope.$on('editColumn', function(event, column) {
		$scope.editColumn.column = column;
		$scope.editColumn.show = true;
		$scope.editColumn.newMode = false;
		// $scope.$apply();
	});

	// Edit column dialogue
	$scope.$on('editColumnConfig', function(event, column, config) {
		$scope.editColumn.column = column;
		$scope.editColumn.config = config;
		$scope.editColumn.newMode = false;
		// $scope.$apply();
	});

	// Store visualisation in memory
	$scope.visArray = [], $scope.currentVis;
	$scope.storeVis = function() {
		constructQuery();
		Visuals.storeVis([$scope.vis], $scope.visArray);
		$scope.currentVis = $scope.vis.Name;
	}

	// Return icon defined on plugin
	$scope.getPluginIcon = function(vis) {
		return rmvpp.Plugins[vis.Plugin].icon
	}

	// Highlight vis on hover over
	$scope.highlightVis = function(vis) {
		$(vis.Container).addClass('highlight');
	}

	$scope.unHighlightVis = function(vis) {
		$(vis.Container).removeClass('highlight');
	}

	// Switches to visualisation mode and selects the visualisation for editing
	$scope.editVis = function(v) {
		$scope.switchVisMode();
		$scope.setCurrentVis(v.Name);
		$scope.showOptions = true;
	}

	// Removes visualisation from the array
	$scope.removeVis = function(vis) {
		Global.confirmDialogue(function() {
			var pos = $.removeFromArray(vis, $scope.visArray);
			$.removeFromArray(vis, $scope.db.Visuals); // Remove from dashboard

			// Remove any interactions involved from dashboard
			$scope.db.Interactions.filter(function(int) {
				return int.SourceNum == vis.ID || int.TargetNum == vis.ID;
			}).forEach(function(int) {
				$.removeFromArray(int, $scope.db.Interactions);
			});

			for (var i=pos; i < $scope.visArray.length; i++) {
				$scope.visArray[i].ID--;
				$scope.visArray[i].Name = $scope.visArray[i].defaultName();
				$scope.visArray[i].resetName();
			}

			// Reset source and target numbers
			$scope.db.Interactions.forEach(function(int) {
				int.SourceNum = int.SourceVis.ID;
				int.TargetNum = int.TargetVis.ID;
			});
		});
	}

	// Open visualisation from memory
	function restoreVis() {
		var re = new RegExp('\\((\\d*?)\\)$');
		if (re.exec($scope.currentVis)) {
			var idx = +re.exec($scope.currentVis)[1]-1 < 0 ? 0 : +re.exec($scope.currentVis)[1]-1;
			var selected = $scope.visArray[idx];
			setScopeVis(selected);
			$scope.renderVis();
		}
	}

	// Set the current scope visualisation to a BIVisual object
	function setScopeVis(vis) {
		if (vis) {
			if (!rmvpp.Plugins[vis.Plugin].multipleDatasets) {
				$scope.subjectArea = vis.Query.SubjectArea;
			} else {
				$scope.subjectArea = vis.Query[Object.keys(vis.Query)[0]].SubjectArea;
			}

			$scope.changeSubjectArea(false);
			$scope.filters = obiee.applyToColumnSets({}, vis.Plugin, function(item, dataset) {
				var query = vis.Query;
				if (dataset) {
					query = vis.Query[dataset];
				}

				if (query.Filters.length > 0) {
					if (query.Filters[0].Type == 'FilterGroup') {
						return query.Filters[0].Filters;
					} else {
						return query.Filters;
					}
				} else {
					return [];
				}
			});

			$scope.plugin = vis.Plugin;
			$scope.vis = vis;
		}
	}

	// New visualisation or dashboard
	$scope.newDB = function() {
		Global.confirmDialogue(function() {
			if ($scope.file) { // Move up a folder if a file has been opened
				var folderUp = $.dirFromPath($scope.webcatPath);
				folderUp = folderUp.substr(0, folderUp.length-1);
				$scope.webcatPath = folderUp;
			}

			if (!$.isEmptyObject($scope.db.Canvas)) {
				if ($scope.db.Canvas.Element)
					$scope.db.Canvas.Element.clear();
			}
			$scope.db = new obiee.BIDashboardPage();
			$scope.resetVis(true);
			$scope.visArray = [];
			$scope.file = '';
		}, 'Discard all changes?', 20);
	}

	$scope.newVis = function() {
		storeAndReset();
		$scope.resetVis(true);
	}

	// Open webcat explorer
	$scope.openWebcat = function(skipOpen) {
		if (!$scope.dashboardMode) {
			Global.webcatExplorer($scope.webcatPath, function(path) {
				if (path) {
					$scope.webcatPath = path;
					$scope.db.Path = path;
					$scope.file = $.fileFromPath(path);
					$scope.currentVis = undefined; // Reset current vis, causes reload
					$scope.visArray = [];
					Global.loadingOn();
					$timeout(function() { // Ensures next code runs on the next digest and so prevents need to force $apply
						obiee.loadDB($scope.webcatPath, function(dbObj) {
							$scope.db = dbObj;
							Visuals.storeVis($scope.db.Visuals, $scope.visArray);
							Visuals.storeVis($scope.db.HiddenVisuals, $scope.visArray);

							setScopeVis(dbObj.Visuals[0]);
							Global.loadingOff();

							Metadata.updateMetadata($scope, $scope.vis, $scope.metadata, $scope.subjectArea, function() {
								$scope.storeVis();
								$scope.$apply();
							});
						});
					});
				}
			}, false, !skipOpen, true);
		} else {
			Global.webcatExplorer($scope.webcatPath, function(path) {
				$scope.webcatPath = path;
				$scope.db.Path = path;
				$scope.file = $.fileFromPath(path);
				Global.loadingOn();
				$timeout(function() {
					$scope.$broadcast('reloadDB', function() {
						Global.loadingOff();
						$scope.db.Visuals.forEach(function(vis) {
							Metadata.updateMetadata($scope, vis, $scope.metadata, $scope.subjectArea);
						});

						$scope.visArray = [];
						Visuals.storeVis($scope.db.Visuals, $scope.visArray);
						Visuals.storeVis($scope.db.HiddenVisuals, $scope.visArray);

						if ($scope.editMode) {
							$scope.$broadcast('enableEdit');
							$scope.$apply();
						}
					});
				})
			}, false, !skipOpen, true);
		}
	}

	// Link to help page for visualisations
	$scope.pluginHelp = function() { window.open('/insights/docs/plugins/' + $scope.plugin + '.html'); }
	$scope.dbHelp = function() { window.open('/insights/docs/user/dashboard-editor.html'); }
	$scope.visHelp = function() { window.open('/insights/docs/user/visualisation-editor.html'); }

	// Watch for current visualisation changes
	$scope.$watch(function () { return $scope.currentVis }, function (newVal, oldVal) {
		constructQuery();
		restoreVis();
	});

	// Sets the current visual to the with the given name
	$scope.setCurrentVis = function(name) {
		Visuals.storeVis([$scope.vis], $scope.visArray);
		$scope.currentVis = name;
	}

	// Add visualisation to dashboard layout when dropped
	$scope.addVis = function(currentVis, x, y) {
		var vis = $scope.visArray.filter(function(v) { return v.Name == currentVis; });
		var existingLayout = $scope.db.Visuals.map(function(v) {return v.Name});
		if (vis.length > 0 && $.inArray(currentVis, existingLayout) == -1) {
			vis = vis[0];
			vis.X = x, vis.Y = y;
			vis.Container = $('.dbLayout');
			if ($.inArray(vis, $scope.db.Visuals) == -1) {
				$scope.db.Visuals.push(vis);
				$scope.$apply();
				if ($scope.db.Prompts.Filters)
					$scope.$broadcast('applyPrompts');
			}
		}
	}

	// Toggle edit mode
	$scope.toggleEditMode = function() {
		if ($scope.designMode)
			disableDesignEditor();

		$scope.editMode = !$scope.editMode;
		if ($scope.editMode) {
			$scope.$broadcast('enableEdit');
		} else {
			$scope.$broadcast('disableEdit');
		}
	}

	function resetFilters() {
		$scope.filters = obiee.applyToColumnSets({}, $scope.vis.Plugin, function() { return []; });
	}

	// Update the visualisation query when a new filter is added
	$scope.filters = [];
	$scope.$on('newFilter', function(event, filter, dataset) {
		if (!$scope.dashboardMode) { // Add filter to visualisation
			$scope.visTab = 'Filters';

			// Reset filter object
			if (typeof($scope.filters) == 'undefined') {
				resetFilters();
			}

			if (!dataset) { // Add filter to all queries if dataset not specified
				$scope.filters = obiee.applyToColumnSets($scope.filters, $scope.vis.Plugin, function(item, dataset) {
					item.push(filter);
					return item;
				});
			} else { // Otherwise add the filter to the specific query (assumes it is a multi-dataset)
				$scope.filters[dataset].push(filter);
			}
		} else { // Add dashboard prompt
			if (!$scope.db.Prompts.Filters) {
				$scope.db.Prompts = new obiee.BIPrompt();
			}
			$scope.db.Prompts.Filters.push(filter);
		}
	});

	// Update the visualisation query when a column is added (double click)
	$scope.$on('addColumn', function(event, addCol) {
		if (!$scope.dashboardMode) {
			var added = false;
			$scope.visTab = 'Column Mappings';

			var addCol = angular.copy(addCol);
			$scope.vis.ColumnMap = obiee.applyToColumnSets($scope.vis.ColumnMap, $scope.vis.Plugin, function(colMap) {
				for (column in colMap) { // Add to  first empty space in column map
					var col = colMap[column];
					if ($.isArray(col) && !added) {
						colMap[column].push(addCol);
						added = true;
					} else if (!col.Code && !added) {
						colMap[column] = addCol;
						added = true;
					}
				}
				return colMap;
			});
			$scope.$apply();
		}
	});

	// Function called when changing subject area
	$scope.changeSubjectArea = function(forceReset) {
		$scope.resetVis(forceReset);
	}

	function storeAndReset() {
		// Automatically store visualisation when changing plugin
		constructQuery();
		Visuals.storeVis([$scope.vis], $scope.visArray);
		$scope.currentVis = '';
	}

	$scope.changePlugin = function() {
		storeAndReset();
		$scope.resetVis();
	}

	// Rename visualisation
	$scope.renameVis = function(vis) {
		var msg = 'Rename Visual'
		Global.textDialogue(function(out) {
			vis.DisplayName = out;
		}, msg, vis.DisplayName)
	}

	// Initialise a blank visualisation object
	$scope.resetVis = function(forceReset) {
		// Keep columns and filters between visualisation type changes
		if ($scope.vis) {
			var prevCM = angular.copy($scope.vis.ColumnMap);
			var prevFilters = angular.copy($scope.filters);
			var prevMulti = rmvpp.Plugins[$scope.vis.Plugin].multipleDatasets;
		}

		$scope.vis = new obiee.BIVisual($scope.plugin);

		// Force reset gets passed in by the subject area dropdown
		if ($scope.vis && !forceReset) {
			$scope.vis.ColumnMap = rmvpp.importColumnMap(prevCM, $scope.plugin);
			if (rmvpp.Plugins[$scope.vis.Plugin].multipleDatasets == prevMulti) {
				$scope.filters = prevFilters;
			} else { // TODO: Implement some filter sharing for multiple datasets
				// console.log('there');
				resetFilters();
			}
		} else if ($scope.vis) {
			$scope.vis.ColumnMap = rmvpp.getDefaultColumnMap($scope.plugin);
			resetFilters();
		}

		$scope.vis.Config = rmvpp.getDefaultConfig($scope.plugin);
		$('.visualisation').empty();
	}
	$scope.resetVis();

	// Construct Query from UI objects
	function constructQuery() {
		function createNewQuery(colMap, subjectArea, filters) {
			var columns = [];
			obiee.applyToColumnMap(colMap, function(col) {
				if (col.Code) {
					columns.push(col);
				}
			});
			var query = new obiee.BIQuery(columns, filters);
			return query;
		}


		$scope.vis.Query = obiee.applyToColumnSets({}, $scope.vis.Plugin, function(query, dataset) {
			var cm = dataset ? $scope.vis.ColumnMap[dataset] : $scope.vis.ColumnMap;
			var filters = dataset ? $scope.filters[dataset] : $scope.filters;
			query = createNewQuery(cm, $scope.subjectArea, filters);
			return query;
		});
	}

	// Render visualisation
	$scope.renderVis = function() {
		constructQuery();
		$scope.vis.Container = $('.visBuilder .visualisation');
		$scope.vis.render();
	}

	// Saves visualisation to the web catalogue
	$scope.saveToWebcat = function() {
		if ($scope.editMode) {
			$scope.$broadcast('disableEdit');
			$scope.editMode = false;
		}

		Global.webcatExplorer($scope.webcatPath, function(path) {
			if (path) {
				$scope.webcatPath = path;
				$scope.file = $.fileFromPath(path);
				if (!$scope.dashboardMode)
					$scope.storeVis();
				save();
			}
		}, true, false, true);
	}

	$scope.saveAs = function() {
		$scope.webcatPath = $.dirFromPath($scope.webcatPath, true);
		if ($scope.dashboardMode)
			$scope.db.Path = $scope.webcatPath;
		$scope.saveToWebcat();
	}

	// Opens the save menu using Angular material
	$scope.openMenu = function($mdOpenMenu, evt) {
		$mdOpenMenu(evt);
	}

	// Save dashboard
	function save(callback) {
		Global.loadingOn('Saving...');
		$timeout(function() {
			if ($scope.db.Visuals.length == 0) // Include at least one visualisation on the dashboard
				$scope.db.Visuals.push($scope.visArray[0]);

			$scope.db.HiddenVisuals = [];
			$scope.visArray.forEach(function(vis) {
				found = $scope.db.Visuals.filter(function(dbVis) {
					return dbVis.Name == vis.Name;
				});

				if (found.length == 0) {
					$scope.db.HiddenVisuals.push(vis);
				}
			});

			if ($scope.db.Visuals[0]) {
				$scope.db.save($scope.webcatPath, function() {
					Global.loadingOff();
					$scope.$apply();
					if (callback)
						callback();
				}, function(err) {
					console.log(err, 'Error saving ' + $scope.webcatPath);
				});
			} else {
				$scope.file = '';
				Global.loadingOff();
				$scope.$apply();
				$scope.showToast('Nothing to Save');
			}
		});
	};

	$scope.showToast = function(msg, icon) {
		var toast = '<md-toast><span class="md-toast-text">' + msg + '</span>';
		if (icon) {
			toast += '<i class="fa fa-' + icon + '"></i>';
		}
		toast += '</md-toast>';
		$mdToast.show({
			hideDelay : 2000,
			position: 'bottom',
			template: toast
		});
	};

	// Show interactions menu
	$scope.toggleInts = function() {
		$scope.showInteracts = !$scope.showInteracts;
	}

	// Preview
	$scope.preview = function() {
		function leave() {
			if ($scope.webcatPath != '/') {
				Global.navigate('/insights/app/states/view/index.html?' + $.param({ 'path' :$scope.webcatPath}));
			} else {
				Global.navigate('/insights/app/states/view/');
			}
		}

		if ($scope.db.Visuals.length > 0) {
			Global.confirmDialogue(function() {
				save(leave);
			}, 'Save before leaving?', 25, function() {
				leave();
			})
		} else {
			leave();
		}
	}

	// Refresh dashboard
	$scope.reloadDB = function() {
		$scope.$broadcast('reloadDB');
	}

	function disableDesignEditor() {
		$scope.designMode = false;
		$scope.db.Canvas.deselectAll();
		$scope.rightPaneWidth = $scope.lastRightPaneWidth;
		if ($scope.rightPaneWidth == 0 && $scope.panesShown)
			$scope.rightPaneWidth = 200;
		angular.element($window).off('keyup keydown');
		angular.element($window).off('keydown');
	}

	// Toggle design mode
	$scope.toggleDesignMode = function() {
		$scope.designMode = !$scope.designMode;
		if ($scope.designMode) {
			$scope.editMode = false;
			$scope.db.createCanvas();
			$scope.lastRightPaneWidth = $scope.rightPaneWidth;
			$scope.rightPaneWidth = 0;
			$scope.$broadcast('disableEdit');
		} else {
			disableDesignEditor();
		}
	}
});
