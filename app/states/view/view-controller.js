app.controller('dbView', function($scope, $mdToast, Global, UIConfig, Metadata, Visuals) {
	$scope.loading = Global.loading;
	$scope.logoffBtn = UIConfig.Buttons.logoff;
	$scope.showPane = false;
	$scope.dbPages = [];

	// Toggles the left pane with dashboard page links
	$scope.togglePane = function() {
		Global.tooltip.hide();
		$scope.showPane = !$scope.showPane;
	};

	$scope.exportToPNG = function() {
		Global.loadingOn('Generating PNG...');
		insights.printDB($scope.db, 'Dashboard', 'png', function(){
			Global.loadingOff($scope);
		});
	};

	$scope.exportToPDF = function() {
		Global.loadingOn('Generating PDF...');
		insights.printDB($scope.db, 'Dashboard', 'pdf', function(){
			Global.loadingOff($scope);
		});
	};

	$scope.exportToCSV = function() {
		Global.loadingOn('Generating CSV files...');
		$scope.db.exportToCSV();
		Global.loadingOff($scope);
	};

	$scope.exportToXLSX = function() {
		Global.loadingOn('Generating Excel file...');
		$scope.db.exportToXLSX();
		Global.loadingOff($scope);
	};

	$scope.refresh = function() {
		$scope.$broadcast('reloadDB');
	}

	$scope.visBuilder = function() {
		Global.navigate('/insights/app/states/visBuilder');
	}

	$scope.exportToExcel = function() {
		$scope.db.exportToExcel();
	}

	// Go to the portal page
	$scope.home = function() {
		Global.navigate('/insights/app/states/portal');
	}

	// Logoff
	$scope.logoff = function() {
		Global.loadingOn('Signing Out...', 'black', 1, 'white');
		obiee.logoff(function() {
			Global.navigate('/insights');
		});
	}

	// Show tooltip on left pane
	$scope.showTooltip = function(name, event) {
		Global.tooltip.displayHTML(name, event);
	}

	$scope.hideTooltip = function() {
		Global.tooltip.hide();
	}

	$scope.db = new obiee.BIDashboardPage();
	$scope.path = rmvpp.getQueryString('path'); // Dashboard page path
	if ($scope.path == '/') $scope.path = ''; // Set to null if path is the root

	$scope.dbPath = rmvpp.getQueryString('db'); // Path of dashboard folder
	$scope.hidePanes = rmvpp.getQueryString('hidePanes') == 'true' ? true : false;

	if (!sessionStorage.obieeSessionId) {
		// Automatically login if SSO configured on OBIEE
		$.ajax({url: '/analytics', type: 'GET'}).done(function() {
			var sessionId = $.getCookie('ORA_BIPS_NQID');
			if (sessionId) {
				setPermissions();
			} else { // Automatically logout if no ID found
				Global.navigate('/insights');
			}
		});
	} else {
		setPermissions();
	}

	// Set permissions and initialise
	function setPermissions() {
		obiee.setRMPermissions(function() { // Set app permissions if not already set
			if (!obiee.hasRMRole('view')) {
				displayError('Insufficient app privileges to see this page.');
				Global.fadeIn();
			} else {
				$scope.isAuthor = obiee.hasRMRole('create');
				init();
			}
		}, function() { // Logout on error
			logoff();
		});
	}

	// Page load function
	$scope.loadPage = function() {
		Global.loadingOn();

		var dirPath = $.dirFromPath($scope.path);
		dirPath = dirPath.substr(0, dirPath.length-1);
		$scope.selectedPage = $.fileFromPath($scope.path);

		// Get other dashboard pages
		obiee.fetchWebcatObjects(dirPath, function(items) {
			items = items.filter(function(item) { return item.type == 'Object'; });
			$scope.dbPages = items.map(function(item) { return item.caption; });
		}, function(err) {
			displayError('Failed to retrieve dashboard pages: ' + err);
			$scope.$apply();
		}, false, false, false, true);

		obiee.loadDB($scope.path, function(dbObj) {
			Global.fadeIn();
			Global.loadingOff();
			dbObj = insights.urlFilters(dbObj); // Apply filters from query string
			dbObj.Container = $('#rm-DBContainer');
			$scope.db = dbObj;
			$scope.$apply();
		}, displayError);
	}

	function displayError(err) {
		Global.loadingOff();
		Global.fadeIn();
		$scope.error = err;
	}

	// Switch dashboard page
	$scope.switchPage = function(page) {
		Global.tooltip.hide();
		Global.loadingOn();
		$scope.path = page ? $.dirFromPath($scope.path) + page : $scope.path;
		$scope.selectedPage = $.fileFromPath($scope.path);

		obiee.loadDB($scope.path, function(dbObj) {
			Global.loadingOff();
			$scope.db = {};
			$scope.$apply();

			dbObj.Container = $('#rm-DBContainer');
			$scope.db = dbObj;
			$scope.error = '';
			$scope.$apply();
		}, function(err) { // Show if there is an error
			Global.loadingOff();
			$scope.db = {};
			$scope.error = err;
		});
	}

	function init() {
		// If the page is OK
		if (!$scope.error) {
			if ($scope.path) {
				$scope.loadPage();
			} else if ($scope.dbPath) {
				Global.loadingOn();
				obiee.fetchWebcatObjects($scope.dbPath, function(objects) {
					if (objects.length > 0) {
						$scope.path = objects[0].path; // Load first page
						$scope.loadPage();
					} else {
						displayError('No pages found.');
					}
				}, function(err) {
					displayError(err);
					$scope.$apply();
				}, false, false, false, true);
			} else {
				Global.fadeIn();
				Global.webcatExplorer(Global.webcatPath, function(path) {
					if (path) {
						$scope.path = path;
						$scope.loadPage();
					}
				});
			}
		} else {
			Global.fadeIn();
		}
	}

	$scope.editDashboard = function() {
		Global.navigate('/insights/app/states/visBuilder/index.html?' + $.param({ 'path' :$scope.db.Path}) + '&' + $.param({ 'mode' : 'db'}));
	}

	// Generate a bookmark of the visualisation and prompts
	function genBookmark() {
		var url = /.*\/insights\/app\/states\/view\/index.html/.exec(window.location.href)[0];
		url += '?path=' + encodeURIComponent($scope.path);
		if ($scope.db.Prompts.Filters) {
			var qParams = [];
			$scope.db.Prompts.Filters.forEach(function(f, i) {
				var proceed = $.isArray(f.Value) ? f.Value.length > 0 : f.Value;
				if (proceed) {
					var qString = 'filter' + (+i+1) + '=' + encodeURIComponent(f.ColumnID);
					qString += '&val' + (+i+1) + '=';
					if ($.isArray(f.Value))
						qString += encodeURIComponent(f.Value.join(';'));
					else
						qString += encodeURIComponent(f.Value);
					qString += '&op' + (+i+1) + '=' + encodeURIComponent(f.Operator);
					qParams.push(qString);
				}
			});
			if (qParams.length > 0)
				url += '&';
			url += qParams.join('&');
		}
		return url;
	}

	$scope.showToast = function(html) {
		var toast = '<md-toast>' + html + '</md-toast>'
		$mdToast.show({
			hideDelay : 2000,
			position: 'bottom',
			template: toast
		});
	};

	// Allow the bookmark button to copy information to the clipboard
	new Clipboard('.topPane #get-link', {
		text: function(trigger) {
			// Global.tooltip.updateText('Copied to Clipboard');
			$scope.showToast('<span class="md-toast-text">Copied</span><i class="fa fa-clipboard"></i>');
			return genBookmark();
		}
	});
});
