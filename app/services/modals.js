// Controller for confirmation modal window
app.controller('ConfirmModalController', function($scope, msg, width, close) {
	msg = msg || 'Are you sure?'
	$scope.msg = msg;
	$scope.width = width || 14;

	$scope.accept = function() { close(true); };
	$scope.cancel = function() { close(false); };
});

// Controller for confirmation modal window
app.controller('FunctionsModalController', function($scope, $http, $sce, Global, close) {
	$scope.selected = {};

	// Fetch icons from JSON file
	Global.loadingOn();
	$http({
		method: 'GET',
		url: '/insights/metadata/bi-functions.json'
	}).then(function (response) { // Success
		Global.loadingOff();
		angular.forEach(response.data, function(v) { v.expand = false; });
		$scope.functions = response.data;
	}, function (response) { // Failure
		Global.loadingOff();
		$scope.cancel();
	});

	$scope.expand = function(folder) {
		folder.expand = !folder.expand;
	}

	$scope.select = function(file) {
		$scope.selected.selected = false;
		file.selected = true;
		$scope.selected = file;
		$scope.showDesc = true;
	}

	$scope.accept = function() { close($scope.selected); };
	$scope.cancel = function() { close(false); };
});

// Controller for icon picker modal window
app.controller('IconModalController', function($scope, $http, Global, icon, close) {
	$scope.msg = 'Choose an Icon';
	$scope.original = icon;
	$scope.selected = icon;

	// Fetch icons from JSON file
	Global.loadingOn();
	$http({
		method: 'GET',
		url: '/insights/icons/icons.json'
	}).then(function (response) { // Success
		Global.loadingOff();
		$scope.icons = response.data.icons;
	}, function (response) { // Failure
		Global.loadingOff();
		$scope.cancel();
	});

	$scope.selectIcon = function(icon) {
		close(icon);
	}

	$scope.cancel = function() { close($scope.original); };
});

// Controller for map picker modal window
app.controller('MapModalController', function($scope, $element, $http, Global, map, name, close) {
	$scope.msg = 'Choose a Map';
	$scope.map = map;
	$scope.name = name;
	$scope.originalMap = angular.copy(map);
	$scope.originalName = angular.copy(name);

	$scope.allMaps = InsightsConfig.MapFeatures;
	var defaultMap = $scope.allMaps.findIndex(function(m) {
		return m.path == $scope.map;
	});

	if (defaultMap > -1) {
		$scope.allMaps[defaultMap].selected = true;
	}

	function getSelected() {
		var selected = $scope.allMaps.filter(function(m) {
			return m.selected;
		});

		if (selected.length > 0) {
			return selected[0];
		} else {
			return {'path' : '', 'name' : 'Unknown'};
		}
	}

	$scope.update = function() {
		previewMap(getSelected().path);
	}

	function previewMap(path) {
		$scope.loading = true;
		if (path) {
			$http.get('/insights/topojson/' + path).then(function(res) {
				var container = $element.find('.mapPreview');
				container.empty();

				var width = container.width() - 20;
	    		var height = container.height() - 25;

				var svg = container.toD3().append("svg")
					.style('margin-top', '10px')
					.style('margin-bottom', '10px')
				    .attr("width", width)
				    .attr("height", height);

				var subunitKey = Object.keys(res.data.objects)[0];

				// Map scaling
				var subunits = topojson.feature(res.data, res.data.objects[subunitKey]);
				var center = d3.geo.centroid(subunits);
				var offset = [width / 2, height / 2];
				var scale = 150;
				var projection = d3.geo.mercator()
					.center(center)
					.scale(scale) // Default for Mercator
					.translate(offset);

				var path = d3.geo.path().projection(projection);

				// Using the path determine the bounds of the current map and use
				// these to determine better values for the scale and translation
				var bounds  = path.bounds(subunits);
				var hscale  = scale*width  / (bounds[1][0] - bounds[0][0]);
				var vscale  = scale*height / (bounds[1][1] - bounds[0][1]);
				var scale   = (hscale < vscale) ? hscale : vscale;
				var offset  = [width - (bounds[0][0] + bounds[1][0])/2,
							   height - (bounds[0][1] + bounds[1][1])/2];

			   // New projection
				projection = d3.geo.mercator()
					.center(center)
					.scale(scale)
					.translate(offset);
				path = path.projection(projection);

				svg.append("path")
					.datum(subunits)
					.attr("d", path)
					.attr({
						"stroke": "#777",
						"stroke-dasharray": "2,2",
						"stroke-linejoin": "round",
						"fill": "#CCC"
					});

				$scope.loading = false;
			}, function(err) {
				$element.find('.mapPreview').empty();
				$scope.loading = false;
			});
		} else {
			$element.find('.mapPreview').empty();
			$scope.loading = false;
		}
	}

	$scope.accept = function() {
		close(getSelected());
	}

	previewMap(getSelected().path);
	$scope.cancel = function() { close(); }
});

app.controller('MapTileModalController', function($scope, $element, Global, tile, close) {
	$scope.msg = 'Choose a Tile Layer';
	$scope.allMaps = Object.keys(InsightsConfig.MapTiles).map(function(m) {
		if (tile == m) {
			return { 'name': m, 'selection': true }
		} else {
			return { 'name': m, 'selection': false }
		}
	});
	$scope.allMaps.push({'name': 'Default', 'selection' : tile == 'Default' ? true : false});

	$scope.update = function() {
		$element.find('.mapPreview').empty();
		$element.find('.mapPreview').append('<div id="map-tile-preview"></div>')
		$element.find('#map-tile-preview').css({
			'height': $element.find('.mapPreview').height(),
			'width': $element.find('.mapPreview').width()
		});

		var map = L.map('map-tile-preview').setView([20, -0], 1);
		var tileLayer = new L.TileLayer[getSelected()]();
		tileLayer.addTo(map);
	}

	function getSelected() {
		var selected = $scope.allMaps.filter(function(m) {
			return m.selected;
		});

		if (selected.length > 0) {
			return selected[0].name;
		} else {
			return '';
		}
	}

	$scope.accept = function() { close(getSelected()); }
	$scope.cancel = function() { close(); }
});

// Controller for icon picker modal window
app.controller('PaletteModalController', function($scope, Global, colours, close) {
	$scope.original = angular.copy(colours);

	if ($.isArray(colours)) { // If the colour is an array, just assign the values
		$scope.colours = colours;
	} else { // Otherwise fetch from configuration
		$scope.colours = angular.copy(InsightsConfig.Palettes[colours]);
	}

	// Angular prefers objects to arrays for ng-repeat
	$scope.colours = $scope.colours.map(function(colour) {
		return {'colour' : colour};
	})

	$scope.remove = function(index) {
		$scope.colours.splice(index, 1);
	}

	$scope.add = function() {
		$scope.colours.push({colour: '#000000'});
	}

	$scope.accept = function() {
		var out = $scope.colours.map(function(col) { return col.colour; });
		close(out);
	};
	$scope.cancel = function() { close($scope.original); };
});

// Controller for confirmation modal window
app.controller('TextModalController', function($scope, msg, textVal, close) {
	msg = msg || 'Specify Text'
	$scope.msg = msg;
	$scope.textVal = textVal || '';
	var origVal = angular.copy(textVal);

	$scope.onKey = function(event) {
		if (event.keyCode == 13)
			close($scope.textVal);
	}

	$scope.accept = function() {
		if ($scope.textVal != origVal) // Check the value has changed
			close($scope.textVal);
		else
			close(false);
	};
	$scope.cancel = function() { close(false); };
});

// Controller for confirmation modal window
app.controller('ImageModalController', function($scope, msg, imageVal, close) {
	msg = msg || 'Choose Image URL';
	$scope.msg = msg;
	$scope.imageVal = imageVal || '';
	var origVal = angular.copy(imageVal);

	$scope.onKey = function(event) {
		if (event.keyCode == 13)
			close($scope.imageVal);
	}

	$scope.accept = function() {
		if ($scope.imageVal != origVal) // Check the value has changed
			close($scope.imageVal);
		else
			close(false);
	};
	$scope.cancel = function() { close(false); };
});

// Controller for advanced filter search modal
app.controller('FilterModalController', function($scope, $window, UIConfig, $timeout, $element, filter, extraTypes, close) {
	$scope.filter = filter;
	$scope.extraTypes = extraTypes;
	$scope.allValues = [];

	$scope.searchOp = "contains";
	$scope.original = angular.copy($scope.filter);

	// Set default selected values
	if ($.isArray(filter.Value))
		$scope.selectedValues = filter.Value.map(function(d) { return {selected: false, val: d} });
	else if (filter.DataType == 'string')
		$scope.selectedValues = filter.Value.split(';').map(function(d) { return {selected: false, val: d} });
	else
		$scope.selectedValues = [];

	$scope.query = new obiee.BIQuery([$scope.filter.Column]);
	$scope.query.MaxRows = 100; // Default row limit for subquerie

	// Subquery for values based on input
	$scope.search = function() {
		var filters = [];
		$scope.allValues = [];

		if ($scope.searchTerm) {
			var filter = new obiee.BIFilter($scope.filter.Column, $scope.searchTerm, $scope.searchOp);
			filters.push(filter);
		}

		$scope.query.Filters = filters;
		$scope.loading = true;
		$scope.query.run(function(data) {
			data.forEach(function(d) {
				$scope.allValues.push({ selected: false, val: d[$scope.filter.Name]});
			});
			$scope.loading = false;
			$scope.$apply();
		});
	};

	$scope.search();

	// Add value to selected list
	$scope.addValue = function(value) {
		var exists = $scope.selectedValues.filter(function(d) { return value.val == d.val; });
		if (exists.length == 0) {
			$scope.selectedValues.push({ selected: false, val: value.val});
		}
	};

	// Add multiple values to selected list
	$scope.addValues = function() {
		var softSelected = $scope.allValues.filter(function(d) { return d.selected; });
		if (softSelected.length > 0) {
			$scope.selectedValues = addLists(softSelected, $scope.selectedValues);
			$scope.allValues.forEach(function(d) { d.selected = false; });
		}
	};

	// Combine two lists, ignoring duplicate matches
	function addLists(list1, list2) {
		list1 = list1.map(function(d) { return { selected: false, val: d.val }; });
		list1 = list1.filter(function(d) { // Check not already in array
			return $.inArray(d.val, list2.map(function(s) { return s.val; })) == -1;
		});
		return list2.concat(list1);
	}

	// Add all possible values to selected list
	$scope.addAllValues = function() {
		$scope.allValues.forEach(function(d) { d.selected = false; });
		$scope.selectedValues = addLists($scope.allValues, $scope.selectedValues);
	}

	// Remove multiple values from selected list
	$scope.removeValues = function() {
		var softSelected = $scope.selectedValues.filter(function(d) { return d.selected; });
		softSelected.forEach(function(d) {
			$.removeFromArray(d, $scope.selectedValues);
		});
	}

	// Remove value from selected list
	$scope.removeValue = function(value) {
		$.removeFromArray(value, $scope.selectedValues);
	};

	$scope.removeAllValues = function() {
		$scope.selectedValues = [];
	}

	$scope.accept = function() {
		if ($scope.filter.ValueType == 'value') {
			if ($scope.filter.DataType == 'string')
				$scope.filter.Value = $scope.selectedValues.map(function(d) { return d.val; })
			close($scope.filter);
		} else {
			$scope.filter.Value = [$scope.filter.Value];
			close($scope.filter);
		}
	};

	if ($scope.filter.ValueType == 'value' && $scope.filter.Column.Measure != 'none') {
		$scope.filter.Value = +$scope.filter.Value;
		if (isNaN($scope.filter.Value))
			$scope.filter.Value = 0;
	}

	$scope.cancel = function() {
		if ($scope.filter.Column.Measure != 'none' && $scope.filter.ValueType == 'value')
			$scope.original.Value = +$scope.original.Value;
		$.extend($scope.filter, $scope.original)
		close($scope.original);
	};
});

// Controller for editing filters in a dashboard prompt
app.controller('PromptFilterModalController', function($scope, Global, filter, close) {
	$scope.filter = filter;
	$scope.original = angular.copy(filter);
	$scope.selectedTab = 'Criteria';

	var defaultQuery = new obiee.BIQuery([$scope.filter.Column], []);
	defaultQuery.MaxRows = 100;
	var defaultLSQL = defaultQuery.lsql();

	// Reverts SQL override to default
	$scope.defaultLSQL = function() {
		$scope.filter.PromptOptions.SQLOverride = defaultLSQL;
	};

	$scope.cancel = function() {
		$scope.filter = $scope.original;
		close($scope.original);
	};

	// Open modal to edit default value
	$scope.editDV = function(dv) {
		if (!dv) {
			var val = $scope.filter.DataType == 'date' ? null : [];
			$scope.filter.PromptOptions.DefaultValues.push({
				ValueType: 'value',
				Value: val
			})
			dv = $scope.filter.PromptOptions.DefaultValues[0];
		}
		var dummyFilter = new obiee.BIFilter($scope.filter.Column, dv.Value, 'in', $scope.filter.SubjectArea);
		dummyFilter.ValueType = dv.ValueType;

		Global.advancedFilter(dummyFilter, true, function(out) {
			dv.ValueType = out.ValueType;
			dv.Value = out.Value;
		});
	}

	// Add a new default value
	$scope.addDefault = function() {
		$scope.filter.PromptOptions.DefaultValues.push({
			ValueType: 'value',
			Value: []
		});
	}

	// Remove a default value
	$scope.removeDV = function(dv) {
		$.removeFromArray(dv, $scope.filter.PromptOptions.DefaultValues);
	}

	// Display formatted values
	$scope.displayVal = function(val) {
		var out;
		if ($.isArray(val)) {
			out = val.join(', ');
		} else {
			if ($scope.filter.DataType == 'date') {
				out = rmvpp.locales['GB'].timeFormat('%d/%m/%Y')(val);
			} else {
				out = val;
			}
		}
		return out;
	}

	// Edits the available choices (not the default values)
	$scope.editChoices = function() {
		if (!$scope.filter.PromptOptions.SubOptions.choices) {
			$scope.filter.PromptOptions.SubOptions.choices = [];
		}

		var dummyFilter = new obiee.BIFilter($scope.filter.Column, $scope.filter.PromptOptions.SubOptions.choices, 'in', $scope.filter.SubjectArea);
		dummyFilter.ValueType = $scope.filter.ValueType;

		Global.advancedFilter(dummyFilter, false, function(out) {
			if (out.ValueType == 'value') {
				$scope.filter.PromptOptions.SubOptions.choices = out.Value;
			}
		});
	}

	$scope.choiceList = function() {
		if ($scope.filter.PromptOptions.SubOptions.choices) {
			return $scope.filter.PromptOptions.SubOptions.choices.join(', ');
		} else {
			return '';
		}
	}

	// Close modal, passing filter back
	$scope.close = function() {
		sql = $scope.filter.PromptOptions.SQLOverride;
		if (sql != defaultLSQL) {
			obiee.executeLSQL(sql, function(success) {
				close($scope.filter);
			}, false,
			function(err) {
				err = obiee.getErrorDetail(err);
				$scope.error = err.basic;
				$scope.$apply();
			});
		} else
			close($scope.filter);
	};
});

// Controller for webcat explorer modal
app.controller('WebcatModalController', function($scope, $element, $window, Global, start, saveMode, folderUp, includeACL, close) {
	$scope.path = start || '/shared'; // Tied to the path explorer bars
	$scope.currentPath = start; // Indicates the directory path shown to the user. Updated by fetchObjects
	$scope.items = [];
	$scope.error = '';
	$scope.saveName = '';
	$scope.saveMode = saveMode;
	$scope.folderPerms = {};
	$scope.cutCopy = { // Object for referencing objects to cut/copy/paste
		path: '',
		type: 'copy'
	}
	$scope.allowed = ['', 'queryitem1']; // Allowed object types (folders and analyses by default)
	$scope.restrictObjects = true; // View only RM objects by default
	$scope.controls = includeACL;

	// Navigate up a folder
	$scope.folderUp = function() {
		var selectItem = $.fileFromPath($scope.path);
		$scope.path = $.dirFromPath($scope.path);
		$scope.path = $scope.path.substr(0, $scope.path.length-1);
		fetchObjects(selectItem);
	}

	if (folderUp) {
		$scope.folderUp();
	} else
		fetchObjects();

	// Fetch at start
	function fetchObjects(selectItem) {
		Global.loadingOn();

		if (!$scope.path) $scope.path = '/'
		obiee.fetchWebcatObjects($scope.path, function(output) {
			Global.loadingOff();
			$scope.currentPath = $scope.path;
			output = output.filter(function(item) {

				// Hijack iterating to assign the dashboard published flag
				var dbPub = [];
				if (item.itemProperties) {
					dbPub = item.itemProperties.filter(function(prop) {
						return prop.name == 'RM-Dashboard';
					});
				}

				if (dbPub.length > 0) {
					if (+dbPub[0].value)
						item.published = true;
				} else {
					item.published = false;
				}

				var keep = true;
				if (item.path == '/system') keep = false;
				if (item.caption == '_internals') keep = false;
				return keep;
			});
			$scope.items = output;

			if (selectItem) {
				if (typeof(selectItem) == 'string') {
					var findItem = $scope.items.filter(function(i) {
						return i.caption == selectItem;
					});

					if (findItem.length > 0)
						findItem[0].selected = true;
				} else if (typeof(selectItem) == 'number') {
					if ($scope.items[0])
						$scope.items[0].selected = true;
				}
			}

			$scope.error = '';

			// Get folder permissions
			obiee.getWebcatItem($scope.path, function(item) {
				$scope.folderPerms = item.permissions;
				$scope.$apply();
			}, function(err) { $scope.$apply();	}); // Fail gracefully

		}, function(err) {
			$scope.items = [];
			showError(err);
		}, '*', 1, true); // Fetch all objects with read permission and ACL security
	}

	function showError(err) {
		Global.loadingOff();
		$scope.error = err;
		if(!$scope.$$phase)
			$scope.$apply();
	}

	// Restrict object types
	$scope.checkType = function(item) {
		var allowed = false;
		if ($.inArray(item.signature, $scope.allowed) > -1) {
			allowed = true;

			// Restrict analyses to those generated by RM Web API
			if (item.signature == 'queryitem1') {
				var remaining = item.itemProperties.filter(function(d) { return d.name == 'RM-Version' });
				if (remaining.length == 0)
					allowed = false;
			}

			if (item.path == '/shared/RM-Insights')
				allowed = false;
		};
		return allowed;
	}

	$scope.fileFromPath = function(path) {
		return $.fileFromPath(path);
	}

	// Open object, unless it's a folder
	$scope.open = function(item) {
		if (item.type  == 'Folder') {
			$scope.path = item.path;
			fetchObjects(1);
		} else {
			$scope.path = item.path;
			angular.element($window).off('keydown');
			$scope.close();
		}
	}

	// Save with a manual name
	$scope.save = function() {
		if ($scope.saveName)
			$scope.open({'path': $scope.path+'/'+$scope.saveName})
		else
			showError('Error: must provide a name.');
	}

	// Delete web catalogue item
	$scope.deleteItem = function (item) {
		disableEvents();
		Global.confirmDialogue(function() {
			Global.loadingOn();
			obiee.deleteWebcatItem(item.path, fetchObjects, showError);
		});
	}

	function disableEvents() {
		angular.element($window).off('keydown');
	}

	// Keyboard events
	function enableEvents() {
		angular.element($window).on('keydown', function(e) {
			if (e.keyCode == 39) { // Right key
				var selected = getSelected();
				if (selected)
					$scope.open(selected);
			}

			if (e.keyCode == 37) // Left key
				$scope.folderUp();

			if (e.keyCode == 27) // Escape key
				$scope.cancel();

			if (e.keyCode == 38) { // Up key
				var selected = getSelected();
				if (selected) {
					var itemPos = $.inArray(selected, $scope.items);
					if (itemPos != 0) {
						selected.selected = false;
						$scope.items[itemPos-1].selected = true;
						$scope.$apply();
					}
				}
			}

			if (e.keyCode == 40) { // Down key
				var selected = getSelected();
				if (selected) {
					var itemPos = $.inArray(selected, $scope.items);
					if (itemPos != $scope.items.length-1) {
						selected.selected = false;
						$scope.items[itemPos+1].selected = true;
						$scope.$apply();
					}
				}
			}

			if (e.keyCode == 46) { // Delete key
				var selected = getSelected();
				if (selected)
					$scope.deleteItem(selected);
			}
		});
	}

	function getSelected() {
		var selected = $scope.items.filter(function(i) { return i.selected;	});
		if (selected.length > 0)
			return selected[0];
		else
			return false;
	}

	// Rename web catalogue item
	$scope.renameItem = function (item) {
		disableEvents();
		Global.textDialogue(function(name) {
			Global.loadingOn();
			obiee.renameWebcatItem(item.path, name, fetchObjects, showError);
		}, 'Rename item', item.caption);
	};

	// Store webcat path for cut/copy operations, used for paste
	$scope.cut = function (item) {
		$scope.cutCopy = {path : item.path, type: 'cut'};
		Global.tooltip.updateText('Cut to Clipboard');
	}

	$scope.copy = function (item) {
		$scope.cutCopy = {path : item.path, type: 'copy'};
		Global.tooltip.updateText('Copied to Clipboard');
	}

	// Pastes object from reference (either moves or copies depending on type).
	$scope.paste = function(item) {
		Global.loadingOn(); $scope.$apply();
		if ($scope.cutCopy.path) {
			var filename = $.fileFromPath($scope.cutCopy.path);
			var pastePath = $scope.currentPath + '/' + filename;

			if (pastePath == $scope.cutCopy.path) {
				if ($scope.cutCopy.type == 'copy') {
					obiee.fetchWebcatObjects($scope.currentPath, function(results) {
						if (results.length > 0) // Match OBIEE duplicate naming convention
							pastePath = $scope.currentPath + '/copy (' + (results.length+1) + ') of ' + filename;
						else
							pastePath = $scope.currentPath + '/copy of ' + filename;

						obiee.copyWebcatItem($scope.cutCopy.path, pastePath, fetchObjects, showError);
					}, function(err) {}, 'copy *of ' + filename);
				}
			} else {
				if ($scope.cutCopy.type == 'copy') {
					obiee.copyWebcatItem($scope.cutCopy.path, pastePath, fetchObjects, showError);
				} else {
					obiee.moveWebcatItem($scope.cutCopy.path, pastePath, fetchObjects, showError);
				}
			}
		}
	}

	// Edit permissions of the item
	$scope.editPerms = function(item) {
		Global.editPermissions(item, function() {
			fetchObjects();
		});
	}

	// Add a new folder
	$scope.newFolder = function() {
		Global.textDialogue(function(name) {
			if (name) {
				name = name.replace(/\//g, '\\/');

				var newFolder = $scope.currentPath + '/' + name;
				Global.loadingOn();
				obiee.createWebcatFolder(newFolder, fetchObjects, showError);
			}
		}, 'New folder');
	}

	// Publish dashboard
	$scope.publish = function(item) {
		Global.publishDB(function() {
			fetchObjects();
		}, item.path);
	}

	// Unpublish dashboard
	$scope.unpublish = function(item) {
		Global.tooltip.hide();
		Global.loadingOn();
		obiee.unpublishDB(item.path, function() {
			fetchObjects();
		});
	}

	enableEvents();

	$scope.go = function() { fetchObjects(); }; // Fetch new results
	$scope.close = function() { disableEvents(); Global.tooltip.hide(); close($scope.path); }; // Close modal, passing selected path
	$scope.cancel = function() { disableEvents(); close(''); }; // Close the modal, passing the original path
});

// Controller for publishing a dashboard
app.controller('PublishDBModalController', function($scope, UIConfig, Global, path, close) {
	Global.loadingOn();
	$scope.db = {'path' : path,	'icon' : '', 'desc' : '', 'tags' : [] };
	$scope.fruitNames = [];
	obiee.getPublishedDBs(function(list) {
		var find = list.filter(function(l) { return l.path == path; });
		if (find.length > 0) {
			$scope.db = find[0];
		}
		Global.loadingOff();
		// $scope.$apply();
	});

	$scope.pathName = function() {
		var out = '';
		if ($scope.db)
			out = $.fileFromPath($scope.db.path);
		return out;
	}

	$scope.accept = function() {
		Global.loadingOn();
		obiee.publishDB($scope.db.path, $scope.db.desc, $scope.db.tags, $scope.db.icon, function() {
			Global.loadingOff();
			close(true);
		}, function(err) {
			$scope.error = err;
		});
	};
	$scope.cancel = function() { close(false); };
});

// Controller for editing web catlaogue permissions (modal)
app.controller('EditPermsModalController', function($scope, Global, item, close) {
	$scope.path = item.path;
	$scope.recursive = true;
	var rawACL = item.acl.accessControlTokens;
	if ($.isPlainObject(rawACL))
		rawACL = [rawACL];
	var appRoles = rawACL.filter(function(acl) { return acl.account.accountType == '4'; });

	$scope.acls = []; // Access control list
	appRoles.forEach(function(appRole) {
		var acl = {
			displayName : appRole.account.displayName,
			name : appRole.account.name,
			guid : appRole.account.guid,
			perms : obiee.permMaskToObj(+appRole.permissionMask)
		};
		$scope.acls.push(acl);
	})

	// Fetch application roles
	obiee.getAccounts(function(accounts) {
		$scope.appRoles = accounts;
		$scope.$apply();
	}, function(err) {
		console.log('Could not fetch accounts: ' + err);
	});

	// Displays just the filename without the rest of the path
	$scope.filename = function() {
		return $.fileFromPath($scope.path);
	}

	// Adds an application role with full permissions to the menu
	$scope.addRole = function(appRole) {
		appRole.perms = obiee.permMaskToObj(65535);
		$scope.acls.push(appRole);
	}

	// Checks if role is in the ACL list
	$scope.checkInACL = function(appRole) {
		var aclNames=  $scope.acls.map(function(acl) { return acl.name; });
		if ($.inArray(appRole.name, aclNames) > -1) {
			return false;
		} else {
			return true;
		}
	}

	// Toggles all permissions (including hidden ones)
	$scope.toggleAll = function(acl) {
		if (acl.perms.changePerms)
			acl.perms = obiee.permMaskToObj(65535); // Grant full privileges
		else {
			acl.perms.changeOwner = false;
			acl.perms.runBIP = false;
			acl.perms.scheduleBIP = false;
			acl.perms.viewBIP = false;
		}
	}

	// Removes an application role from the permissions menu
	$scope.remove = function(acl) {
		$.removeFromArray(acl, $scope.acls);
	}

	// Try to write the permissions to the file
	$scope.accept = function() {
		Global.loadingOn();

		obiee.updateWebcatPerms($scope.path, $scope.acls, function(response) {
			Global.loadingOff();
			$scope.$apply();
			close(true);
		}, function(err) {
			Global.loadingOff();
			$scope.error = err.faultstring;
			$scope.$apply();
		}, $scope.recursive)
	}

	$scope.cancel = function() { close(); };
});

// Controller for editing conditional formats modal window
app.controller('EditCFModalController', function($scope, Global, UIConfig, cf, visColumns, plugin, close) {
	$scope.width = 30;
	$scope.edit = cf ? angular.copy(cf) : new obiee.BIConditionalFormat();
	console.log($scope.edit);
	$scope.visColumns = visColumns;
	$scope.multi = rmvpp.checkMulti(plugin);
	$scope.plugin = plugin;
	$scope.targetCols = {}, $scope.allCols = [];
	$scope.noValue = false;
	$scope.iconLabel = 'Icon';

	// Operator dropdown
	$scope.operators = [
		{id: 'equal', name: '=='},
		{id: 'notEqual', name: '!='},
		{id: 'greater', name: '>'},
		{id: 'greaterOrEqual', name: '>='},
		{id: 'less', name: '<'},
		{id: 'lessOrEqual', name: '<='}
	];

	if ($.isArray(rmvpp.Plugins[$scope.plugin].specialCondFormats)) {
		rmvpp.Plugins[$scope.plugin].specialCondFormats.forEach(function(cf) {
			$scope.operators.push({ id: cf.id, name: cf.name, noValue: cf.noValue });
		});
	}

	$scope.opChange = function() {
		currentOp = $scope.operators.filter(function(op) {
			return op.id == $scope.edit.Operator;
		})[0];
		$scope.noValue = currentOp.noValue;
	}

	// Check if the icon input should be displayed
	$scope.checkIcon = function() {
		if ($scope.allCols.length > 0) {
			var target;
			if ($scope.edit) {
				target = $scope.edit.targetProperty();
				if (!target) {
					target = $scope.allCols[0].id;
					dataset = $scope.allCols[0].dataset
				}
			} else {
				target = $scope.allCols[0].id;
				dataset = $scope.allCols[0].dataset
			}

			var cmProp = rmvpp.getColMapParams($scope.plugin, dataset).filter(function(cmp) {
				return cmp.targetProperty == target;
			})[0];

			if (cmProp) {
				var fmt = cmProp.conditionalFormat;
				if (typeof(fmt) == 'string' && fmt.indexOf('icon') > -1) {
					$scope.showIcon = true;
				} else {
					$scope.showIcon = false;
				}
			}
		}
	}

	function pushCol(prop, col, dataset) {
		var propName = rmvpp.getColMapParams($scope.plugin, dataset).filter(function(cmp) {
			return cmp.targetProperty == prop;
		})[0].formLabel;

		if ($.isArray(col)) {
			col.forEach(function(c, i) {
				$scope.allCols.push({'id': prop+i, 'group': propName, 'name': c.Name, 'dataset': dataset});
			});
			if (col.length > 1) {
				$scope.allCols.push({'id': prop, 'group': '', 'name': 'All ' + propName, 'dataset': dataset});
			}
		} else {
			if (col.Code) {
				$scope.allCols.push({'id': prop, 'group': '', 'name' : col.Name, 'dataset': dataset});
			}
		}
	}

	function groupCol(prop, col, dataset) {
		var propName = rmvpp.getColMapParams($scope.plugin, dataset).filter(function(cmp) {
			return cmp.targetProperty == prop;
		})[0];

		if (propName.conditionalFormat) {
			if ($.isArray(col)) {
				col.forEach(function(c, i) {
					if (!$scope.targetCols.hasOwnProperty(propName.formLabel))  { $scope.targetCols[propName.formLabel] = [] };
					$scope.targetCols[propName.formLabel].push({'id': prop+i, 'group': propName.formLabel, 'name': c.Name, 'dataset': dataset});
				});

				if (col.length > 1) {
					if (!$scope.targetCols.hasOwnProperty('All')) { $scope.targetCols['All'] = [] };
					$scope.targetCols.All.push({'id': prop, 'group': 'All', 'name': 'All ' + propName.formLabel, 'dataset': dataset});
				}
			} else {
				if (col.Code) {
					if (!$scope.targetCols.hasOwnProperty('Single')) { $scope.targetCols['Single'] = [] };
					$scope.targetCols.Single.push({'id': prop, 'group': 'Single', 'name' : col.Name, 'dataset': dataset});
				}
			}
		}
	}

	// Create flat column name array from column map
	for (prop in $scope.visColumns) {
		if ($scope.multi) {
			for (sub in $scope.visColumns[prop]) {
				pushCol(sub, $scope.visColumns[prop][sub], prop);
				groupCol(sub, $scope.visColumns[prop][sub], prop);
			}
		} else {
			pushCol(prop, $scope.visColumns[prop]);
			groupCol(prop, $scope.visColumns[prop]);
		}
	}
	$scope.checkIcon();

	$scope.accept = function() {
		console.log($scope.edit.TargetID);
		var source = $scope.allCols.filter(function(f) { return f.id == $scope.edit.SourceID; });
		var target = $scope.allCols.filter(function(f) { return f.id == $scope.edit.TargetID; });

		if (source.length > 0 && target.length > 0) {
			$scope.error = '';
			$scope.edit.SourceName = source[0].name;
			$scope.edit.TargetName = target[0].name;
			$scope.edit.Dataset = source[0].dataset;
			close($scope.edit);
		} else {
			$scope.error = 'Source and target columns have not been properly defined.'
		}
	};
	$scope.cancel = function() { close(false); };
});

// Controller for editing interactions modal window
app.controller('EditInteractModalController', function($scope, Global, interact, visuals, close) {
	$scope.width = 80;
	$scope.visuals = visuals;
	$scope.edit = angular.copy(interact);

	// Visuals don't quite match after copy due to Angular equality checking so need to be reset
	$scope.edit.SourceVis = $scope.visuals.filter(function(v) { return v.ID == interact.SourceVis.ID; })[0];
	$scope.edit.TargetVis = $scope.visuals.filter(function(v) { return v.ID == interact.TargetVis.ID; })[0];

	// List of avilable triggers for the visualisation
	$scope.triggers = function() {
		if ($scope.edit.SourceVis.Plugin) {
			var trigs = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions;
			return trigs;
		} else {
			return [];
		}
	}

	// Reset the trigger on visualisation change
	$scope.resetTrigger = function() {
		$scope.edit.Trigger = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions[0].trigger;
		$scope.edit.Columns = $scope.edit.getDefaultColumns();
	}

	// Description of the selected trigger
	$scope.triggerDesc = function() {
		var desc = 'No interactions available.';
		var trigObj = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions.filter(function(a) { return a.trigger == $scope.edit.Trigger; })[0];
		if (trigObj) {
			desc = trigObj.description;
		}
		return desc;
	};

	// List of available reactions for the target visualisation.
	$scope.reactions = function() {
		if ($scope.edit.TargetVis.Plugin) {
			var acts = rmvpp.Plugins[$scope.edit.TargetVis.Plugin].reactions;
			return acts;
		} else {
			return [];
		}
	}

	// Reset action on visualisation change
	$scope.resetReaction = function() {
		$scope.edit.Action = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].reactions[0].id;
	}

	// Description of the selected reaction
	$scope.reactionDesc = function() {
		var desc = 'No reactions available.';
		var actObj = rmvpp.Plugins[$scope.edit.TargetVis.Plugin].reactions.filter(function(a) { return a.id == $scope.edit.Action; })[0];
		if (actObj)
			desc = actObj.description;
		return desc;
	}

	$scope.getColNameFromID = function(id) {
		return obiee.getColNameFromVisAndTrigger(id, $scope.edit.SourceVis, $scope.edit.Trigger);
	}

	$scope.accept = function() {
		close($scope.edit);
	};

	$scope.cancel = function() {
		close(false);
	};
});

// Controller for editing drilldowns modal window
app.controller('EditDrillModalController', function($scope, Global, drill, visuals, close) {
	$scope.width = 80;
	$scope.visuals = visuals;
	$scope.edit = angular.copy(drill);

	// Visuals don't quite match after copy due to Angular equality checking so need to be reset
	$scope.edit.SourceVis = $scope.visuals.filter(function(v) { return v.ID == drill.SourceVis.ID; })[0];

	// List of avilable triggers for the visualisation
	$scope.triggers = function() {
		if ($scope.edit.SourceVis.Plugin) {
			var trigs = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions;
			return trigs;
		} else
			return [];
	}

	// Reset the trigger on visualisation change
	$scope.resetTrigger = function() {
		$scope.edit.Trigger = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions[0].trigger;
		$scope.edit.Columns = $scope.edit.getDefaultColumns();
	}

	// Description of the selected trigger
	$scope.triggerDesc = function() {
		var desc = 'No interactions available.';
		var trigObj = rmvpp.Plugins[$scope.edit.SourceVis.Plugin].actions.filter(function(a) { return a.trigger == $scope.edit.Trigger; })[0];
		if (trigObj)
			desc = trigObj.description;
		return desc;
	};

	$scope.getColNameFromID = function(id) {
		return obiee.getColNameFromVisAndTrigger(id, $scope.edit.SourceVis, $scope.edit.Trigger);
	}

	$scope.openWebcat = function() {
		Global.webcatExplorer($scope.edit.DrillPath, function(path) {
			if (path) {
				$scope.edit.DrillPath = path;
			}
		}, false, true);
	}

	$scope.accept = function() { close($scope.edit); };
	$scope.cancel = function() { close(false); };
});

// Controller for editing column selectors modal window
app.controller('EditCSModalController', function($scope, Global, cs, visuals, close) {
	$scope.width = 80;
	$scope.visuals = visuals;
	$scope.edit = angular.copy(cs);

	$scope.edit.updateVisuals($scope.visuals);

	$scope.subjectArea = Global.subjectArea;
	$scope.metadata = Global.biMetadata;
	$scope.subjectAreas = Global.subjectAreas;

	// Add a column when double clicked in the left pane
	$scope.$on('addColumn', function(event, addCol) {
		$scope.edit.Columns.push(addCol);
		$scope.$apply();
	});

	$scope.removeColumn = function(col) {
		$.removeFromArray(col, $scope.edit.Columns);
	}

	$scope.accept = function() {
		if ($scope.edit.Columns.length < 2) {
			$scope.error = 'Not enough columns selected.';
		} else if ($scope.edit.Visuals.filter(function(v) { return v.enabled; }).length == 0) {
			$scope.error = 'No visualisations selected.';
		} else {
			$scope.error = '';
		}

		if (!$scope.error)
			close($scope.edit);
	};
	$scope.cancel = function() { close(false); };
});

// Controller for editing column selectors modal window
app.controller('EditVSModalController', function($scope, Global, vs, visuals, close) {
	$scope.width = 30;
	$scope.visuals = visuals;
	$scope.edit = angular.copy(vs);

	$scope.accept = function() {
		var enabledVisuals = $scope.edit.Visuals.filter(function(v) { return v.enabled; });
		if (enabledVisuals.length < 2) {
			$scope.error = 'Not enough visualisations selected.';
		} else {
			$scope.error = '';
		}

		// Choose the first visualisation if default is inapplicable
		if (enabledVisuals.filter(function(v) { return v.name == $scope.edit.Default; }).length == 0) {
			$scope.edit.Default = $scope.edit.selectDefault()
		}

		if (!$scope.error)
			close($scope.edit);
	};
	$scope.cancel = function() { close(false); };
});
