app.controller('loginForm', function($scope, $timeout, Global, UIConfig) {
	$scope.username = '';
	$scope.password = '';
	$scope.loading = Global.loading;

	$scope.keyLogin = function(event) {
		if (event.keyCode == 13)
			$scope.login();
	}

	Global.maskScreen();

	// Navigate to vis builder or viewer depending on RM app permissions
	function navigateOnLogin() {
		obiee.setRMPermissions(function() {
			if (obiee.hasRMRole('view')) {
				Global.navigate('/insights/app/states/portal');
			} else {
				$scope.error = 'Cannot login due to insufficient web app privileges';
				$scope.$apply();
			}
		}, function(err) { // On error
			console.log(err);
			obiee.logoff(function() {
				Global.fadeIn();
				Global.loadingOff();
				$scope.$apply();
			});
		});
	};

	// Automatically login if ID found
	if (sessionStorage.obieeSessionId) {
		navigateOnLogin();
	} else {
		// Automatically login if SSO configured on OBIEE
		$.ajax({url: '/analytics', type: 'GET'}).done(function() {
			var sessionId = $.getCookie('ORA_BIPS_NQID');
			if (sessionId) {
				navigateOnLogin();
			} else {
				Global.fadeIn();
				$scope.$apply();
			}
		});
	}

	$scope.login = function() {
		Global.loadingOn('Logging In...', '#2B2B2B', 1, 'white');
		$timeout(function() {
			obiee.logon($scope.username, $scope.password,
				function() { // Success
					$scope.error = "";
					$scope.$apply();
					navigateOnLogin();
				},
				function(err) { // Failure
					Global.loadingOff();
					$scope.error = err;
					$scope.$apply();
				}
			);
		});
	};

	$scope.error = "";
});
