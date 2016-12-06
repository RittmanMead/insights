// Main controller for the dashboard/interface portal	$scope.dbs = [];
app.controller('portal', function($scope, $timeout, $window, Global, UIConfig) {
	$scope.dbs = [], $scope.search = '';

	// Check if logged in
	if (!sessionStorage.obieeSessionId) {
		// Automatically login if SSO configured on OBIEE
		$.ajax({url: '/analytics', type: 'GET'}).done(function() {
			var sessionId = $.getCookie('ORA_BIPS_NQID');
			if (sessionId)
				setPermissions();
			else { // Automatically logout if no ID found
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
				$scope.error = 'Insufficient app privileges to see this page.';
				Global.fadeIn();
				$scope.$apply();
			} else
				init();
		}, function() { // Logout on error
			logoff();
		});
	}

	// Initialisation function once session and permissions have been established
	function init() {
		$scope.create = obiee.hasRMRole('create');
		obiee.getPublishedDBs(function(list) {
			$scope.dbs = list;
			$scope.$apply();
			Global.fadeIn();
		}, true);
	}

	$scope.showText = function(text) {
		$scope.desc = text;
		$scope.show = true;
	}

	$scope.hideText = function() {
		$scope.show = false;
	}

	$scope.navigate = function(url) {
		Global.navigate(url);
	}

	// Navigate to dashboard
	$scope.goToDB = function(path) {
		Global.navigate('/insights/app/states/view/index.html?' + $.param({ 'db' : path}));
	}
});
