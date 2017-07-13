/**
 * @overview RM Insights OBIEE module
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* OBIEE integration module containing all of the functions required to interface with the BI server. This
	* includes session management, dynamic querying, metadata management and catalogue interface.
	* @exports obiee
*/
var obiee = (function() {
	var obiee = {};

	/** Holds the RM Analytics version number. */
	var rmVersion = '1.0'; // Version number

	/* ------ WEB SERVICE INTEGRATION ------ */

	/**
		* Holds version of OBIEE WSDL file, containing SOAP structure for all available methods.
		* 11.1.1.7 has v8 as the latest, 11.1.1.9 has v9 and 12c has v12. These are generally compatible with
		* each other but the version can be changed/overidden here if necessary.
		* @memberOf module:obiee
	*/
	var wsdl = InsightsConfig.WSDLVersion;
	var obieeURL = '/analytics-ws/saw.dll';

	/**
		* Generic OBIEE web service call. URL should be of the form `http(s)://<biserver>:<port>/analytics-ws/saw.dll`.
		* RegEx is used to automatically guess the server and port from the current page URL.
		* @private
		* @param {String} url OBIEE URL to make web service call to
		* @param {String} inpData XML SOAP message to send
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errorFunc Callback function to execute on failure
	*/
	function wsCall(service, inpData, successFunc, errorFunc) {
		errorFunc = errorFunc || false;

		// Parse the response text from the server
		function parseResponse(response, successFunc, errorFunc) {
			response = cleanupXML(response);

			try {
				response = $.xml2json(response); // Should remove the encoding line if it appears
			} catch(err) {
				errorFunc('Failed to parse response XML.\n\n' + response);
			}
			if ('Fault' in response.Body) {  // Catch error
				if (!errorFunc){
					var errMsg = response.Body.Fault.faultstring;
					if (/Invalid session ID or session expired/.exec(response.Body.Fault.faultstring)) { // Check if session has expired and logout
						obiee.logoff(function() { // Logoff and navigate to homepage
							window.location.href = '/insights';
						});
					} else {
						console.log(response.Body.Fault);
						throw 'OBIEE execution error. See above for details.';
					}
				} else {
					errorFunc(response.Body.Fault);
				}
			} else
				successFunc(response);
		}

		$.ajax({
			url: obieeURL + '?SOAPImpl=' + service,
			type: "POST",
			dataType: "xml",
			data: inpData,
			contentType: "text/xml; charset=\"utf-8\""
		}).done(function(response) {
			response = new XMLSerializer().serializeToString(response.documentElement);
			parseResponse(response, successFunc, errorFunc);
		}).fail(function(jqXHR, textStatus, errorThrown) {
			response = jqXHR.responseText;
			if (jqXHR.status == 200) // If the call to the server was successful.
				parseResponse(response, successFunc, errorFunc);
			else
				errorFunc(textStatus + ': ' + errorThrown);
		});
	}

	/** Clean up bad characters found in XML repsonses. */
	function cleanupXML(xml) {
		xml = xml.replace(/\x00/g, ''); // Remove any hexadecimal null characters
		xml = xml.replace(/&shy;/g, '');
		return xml;
	}

	/** Sanitise string - replace special characters with their safe SOAP XML equivalents. */
	function sanitiseForXML(str) {
		str = str.replace(/&/g, '&amp;');
		str = str.replace(/</g, '&lt;');
		str = str.replace(/>/g, '&gt;');
		str = str.replace(/\\/g, '&apos;');
		str = str.replace(/"/g, '&quot;');
		return str;
	}

	/** SOAP header required for all OBIEE web service requests */
	function obieeSOAPHeader() {
		return '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:'+wsdl+'="urn://oracle.bi.webservices/'+wsdl+'" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/>';
	}

	/** SOAP WSDL service URL */
	function obieeSOAPService(service) {
		return obieeURL + '?SOAPImpl=' + service;
	}

	/* ------ END OF WEB SERVICE INTEGRATION ------ */

	/* ------ SESSION MANAGEMENT ------ */

	/**
		* Holds OBIEE session ID. This is either set by the {@link logon} function or is obtained from the `ORA_BIPS_NQID` cookie set by vanila OBIEE.
		* The value is then stored in `sessionStorage.obieeSessionId`.
		* @memberOf module:obiee
		* @private
		* @see logon
	*/
	var obieeSessionId = getCookie('ORA_BIPS_NQID');
	if (obieeSessionId) {
		sessionStorage.obieeSessionId = obieeSessionId;
	}

	/**
		* Asynchronously logs into OBIEE and saves the session ID to `sessionStorage.obieeSessionId`.
		* Also Clears `ORA_BIPS_NQID` cookie if it has already been set.
		* @param {String} user OBIEE username
		* @param {String} pass OBIEE password
		* @param {function} successFunc Callback function on successful login
		* @param {function} errFunc Callback function on login failure
		* @returns {Object} The web service response to the callback function
		* @see obieeSessionId
		* @example
		* obiee.logon('weblogic', 'Password01', function(response) {
		*	console.log(sessionStorage.obieeSessionId); // OBIEE session ID stored here
		* }
	*/
	obiee.logon = function (user, pass, successFunc, errFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':logon><'+wsdl+':name>' + user + '</'+wsdl+':name><'+wsdl+':password>' + pass + '</'+wsdl+':password></'+wsdl+':logon>';
		soapMessage += '</soapenv:Body></soapenv:Envelope>'

		eraseCookie('ORA_BIPS_NQID','/'); // Remove cookie if it exists (Only possible if HttpOnlyCookies set to false)
		wsCall('nQSessionService', soapMessage, function(response) {
			sessionId = response.Body.logonResult.sessionID.text;
			sessionStorage.obieeSessionId = sessionId;
			createCookie('ORA_BIPS_NQID', sessionId, 1, '/');
			obiee.setRMPermissions(function() {
				successFunc();
			});
		}, function(err) {
			if (err.faultstring)
				errFunc(err.faultstring)
			else
				errFunc(err);
		});
	}

	/**
		* Logs off an OBIEE session. Also clears the `ORA_BIPS_NQID` cookie and removes `obieeSessionId` from storage.
		* @param {function} successFunc Callback function to execute on success
	*/
	obiee.logoff = function (successFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':logoff><'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':logoff></soapenv:Body></soapenv:Envelope>';
		eraseCookie('ORA_BIPS_NQID','/');
		sessionStorage.removeItem('obieeSessionId');
		sessionStorage.removeItem('obieeUser');
		// sessionStorage.removeItem('rmWebAppRoles');
		wsCall('nQSessionService', soapMessage, successFunc, successFunc);
	}

	/**
		* Get OBIEE username for the current session.
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute upon failure.
		* @returns {String} Current session's OBIEE username.
	*/
	obiee.getUsername = function (successFunc, errFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getSessionEnvironment><'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID></'+wsdl+':getSessionEnvironment>';
		soapMessage += '</soapenv:Body></soapenv:Envelope>';
		wsCall('nQSessionService', soapMessage, function(response) {
			username = response.Body.getSessionEnvironmentResult['return'].userName;
			successFunc(username);
		}, errFunc);
	}

	/* ------ END OF SESSION MANAGEMENT ------ */

	/* ------ SECURITY FUNCTIONS ------ */

	/**
		* Gets a list of all application roles belonging to the current user.
		* @param {function} successFunc Callback function upon successful retrieval of application roles.
		* @param {function} errFunc Callback function to execute upon failure.
		* @returns {string[]} List of application roles belonging to the user.
	*/
	obiee.getAppRoles = function(successFunc, errFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getGroups><'+wsdl+':member><'+wsdl+':name>';
		soapMessage += sessionStorage.obieeUser + '</'+wsdl+':name></'+wsdl+':member>';
        soapMessage += '<'+wsdl+':expandGroups>False</'+wsdl+':expandGroups>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':getGroups></soapenv:Body></soapenv:Envelope>';

		wsCall('securityService', soapMessage, function(response) {
			var appRoles = [];
			var results = response.Body.getGroupsResult || {account: []};
			if (results.account) {
				results.account.forEach(function(r) {
					if (r.accountType == '4')
						appRoles.push({id: r.name, name: r.displayName});
				});
			}
			successFunc(appRoles);
		}, errFunc);
	}

	/** Array containing list of all RM application roles given to the user. Used on initialisation of pages. */
	var RMAppRoles = [];

	/**
		* Executes necessary OBIEE calls to fetch web app permissions if not already obtained and save them to `RMAppRoles`.
		* @param {function} successFunc Callback function to execute once the permissions have been saved.
		* @param {function} errFunc Callback function to execute once the permissions have been saved.
	*/
	obiee.setRMPermissions = function(successFunc, errFunc) {
		function obieeToRM(callback) {
			obiee.getAppRoles(function(appRoles) {
				var rmRoles = [];
				for (role in InsightsConfig.Security) {
					mappedRole = InsightsConfig.Security[role];
					if ($.inArray(mappedRole, appRoles.map(function(r) { return r.id; })) > -1)
						rmRoles.push(role);
				}
				RMAppRoles = rmRoles;
				callback();
			}, errFunc);
		}

		// If RMAppRoles already populated, skip OBIEE query
		if (RMAppRoles.length == 0) {
			if (sessionStorage.obieeUser) { // Check if the username is available
				obieeToRM(successFunc);
			} else {
				obiee.getUsername(function(user) {
					sessionStorage.obieeUser = user;
					obieeToRM(successFunc);
				}, errFunc);
			}
		} else
			successFunc();
	}

	/**
		* Checks against session storage to see if the current user has a given RM web app privilege.
		* @param {string} role RM web app role to check for. Can be any of the properties in InsightsConfig.Security.
		* @return {boolean} Indicates whether or not the privilege is present.
	*/
	obiee.hasRMRole = function(role) {
		return $.inArray(role, RMAppRoles) > -1;
	}

	/* ------ END OF SECURITY FUNCTIONS ------ */

	/* ------ METADATA FUNCTIONS ------ */

	/**
		* Get available subject areas for the current session.
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute on failure
		* @returns {Array} List of subject area names
	*/
	obiee.getSubjectAreas = function(successFunc, errFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getSubjectAreas>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':getSubjectAreas></soapenv:Body></soapenv:Envelope>';
		wsCall('metadataService', soapMessage, function(response) {
			outputData = response;
			outputData = outputData.Body.getSubjectAreasResult.subjectArea;
			if (Object.prototype.toString.call( outputData ) === '[object Object]') {
				outputData = [outputData];
			}
			successFunc(outputData);
		}, errFunc);
	}

	/**
		* Get metadata object describing presentation tables and columns for a given subject area.
		* @param {String} subjectArea Subject area to retrieve metadata for
		* @param {function} successFunc Callback function to execute on success
		* @returns {BIPres} List of subject area names
	*/
	obiee.getTablesAndCols = function(subjectArea, successFunc) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':describeSubjectArea>';
		soapMessage += '<'+wsdl+':subjectAreaName>' + subjectArea + '</'+wsdl+':subjectAreaName>';
		soapMessage += '<'+wsdl+':detailsLevel>IncludeTablesAndColumns</'+wsdl+':detailsLevel>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':describeSubjectArea></soapenv:Body></soapenv:Envelope>';
		wsCall('metadataService', soapMessage, function(response) {
			outputData = response;
			outputData = outputData.Body.describeSubjectAreaResult.subjectArea.tables;

			if ($.isPlainObject(outputData)) // If only one record found, will not automatically be put into an array
				outputData = [outputData];

			var biObject = parseTablesAndCols(subjectArea, outputData);
			successFunc(biObject);
		})
	};

	/** Parse presentation information into flat object array of columns */
	function parseTablesAndCols(subjectArea, tabColData) {
		var presObj = {}, tableObj = {}, allColObj = {};

		for (var i=0; i < tabColData.length; i++) {
			var tabCol = {};

			columns = tabColData[i].columns;
			if (typeof(columns) === "undefined")
				columns = [];

			if (Object.prototype.toString.call( columns ) === '[object Object]')
				columns = [columns];

			for (var j=0; j < columns.length; j++) {
				tableName = tabColData[i].name.substring(1, tabColData[i].name.length-1);
				col = new obiee.BIColumn(tabColData[i].name + '.' + columns[j].name, columns[j].displayName, columns[j].dataType, tableName, columns[j].aggrRule, subjectArea);
				col.Description = columns[j].description;
				allColObj[tableName+'.'+col["Name"]] = col;
				tabCol[col["Name"]] = col;
			}

			if (!tabColData[i].parentTableName) {
				table = new obiee.BITable(tabColData[i].name, tabColData[i].displayName, tabColData[i].description, tabCol);
				tableObj[table["Name"]] = table;
			} else {
				tabParent = tabColData[i].parentTableName.substring(1, tabColData[i].parentTableName.length-1);
				findParent(tableObj, tabCol, tabColData[i], tabParent); // Recursively assign child tables to parent
			}
		}

		presObj = new obiee.BIPres(subjectArea, allColObj, tableObj);
		return presObj;
	}

	/** Recursively find parent presentation table in a table object */
	function findParent(tableObj, tabColObj, tabColRaw, tabParent) {
		var found = false;
		for (key in tableObj) {
			if (tabParent == key) {
				table = new obiee.BITable(tabColRaw.name, tabColRaw.displayName, tabColRaw.description, tabColObj, tabParent);
				tableObj[table["Parent"]]["Children"][table["Name"]] = table;
			} else {
				findParent(tableObj[key].Children, tabColObj, tabColRaw, tabParent);
			}
		}
		return tableObj;
	}

	/* ------ END OF METADATA FUNCTIONS ------ */

	/* ------ EXECUTION FUNCTIONS ------ */

	/**
		* Executes a query from a file containing OBIEE analysis XML.
		* @param {String} xmlFile URL to XML file containing an OBIEE analysis
		* @param {function} successFunc Callback function to execute on success
		* @returns {Array} Resulting dataset from the BI Server. Each element represents a row, and contains an object where each property is a column.
	*/
	obiee.executeXMLFile = function(xmlFile, successFunc) {
		$.ajax({
			url: xmlFile,
			type: "GET",
			dataType: "xml",
			success: function(results) {
				executeXML(results, successFunc);
			}
		});
	}

	/**
		* Executes a logical SQL statement against the BI Server.
		* @param {String} lsql Logical SQL to execute
		* @param {function} successFunc Callback function to execute on success
		* @param {BIQuery} biQuery BIQuery object which can be used to name columns on the resulting dataset
		* @param {function} errFunc Callback function to execute on failure
		* @returns {Array} Resulting dataset from the BI Server. Each element represents a row, and contains an object where each property is a column.
		* If a BIQuery object was provided, column names will be used for object property names.
	*/
	obiee.executeLSQL = function(lsql, successFunc, biQuery, errorFunc) {
		biQuery = biQuery || ""; // Set to null if unspecified
		var override = errorFunc ? true : false;

		// Escape special characters
		lsql = sanitiseForXML(lsql);

		var soapMessage =  obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':executeSQLQuery><'+wsdl+':sql>' + lsql + '</'+wsdl+':sql>';
		soapMessage += '<'+wsdl+':outputFormat>SAWRowsetData</'+wsdl+':outputFormat>';
		soapMessage += '<'+wsdl+':executionOptions><'+wsdl+':async>FALSE</'+wsdl+':async>';
		soapMessage += '<'+wsdl+':maxRowsPerPage>1000000</'+wsdl+':maxRowsPerPage>';
		soapMessage += '<'+wsdl+':refresh>TRUE</'+wsdl+':refresh><'+wsdl+':presentationInfo>FALSE</'+wsdl+':presentationInfo>';
		soapMessage += '<'+wsdl+':type>query</'+wsdl+':type></'+wsdl+':executionOptions><'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':executeSQLQuery></soapenv:Body></soapenv:Envelope>';

		var callback = function(response) {
			outputData = response;
			outputData = $.xml2json(outputData.Body.executeSQLQueryResult["return"].rowset).Row;
			if ($.isPlainObject(outputData))
				outputData = [outputData];

			// Map output in accordance with input obiee.BIQuery criteria names
			if (biQuery != "")
				outputData = mapResults(biQuery, outputData);

			successFunc(outputData);
		}

		wsCall('xmlViewService', soapMessage, callback, errorFunc);
	}

	/* ------ END OF EXECUTION FUNCTIONS ------ */

	/* ------ INTERNAL QUERY FUNCTIONS ------ */

	/** Map column names to output result set */
	function mapResults(biQuery, outputData) {
		if (typeof(outputData) === 'undefined') {
			outputData = [];
		} else {
			for (var i=0; i < outputData.length; i++) {
				biQuery.Criteria.forEach(function(criterium, j) {
					var key = 'Column' + j;
					if (key in outputData[i]) {
						outputData[i] = renameProperty(outputData[i], key, criterium.Name);
						if (wsdl == 'v8') {  // Workaround for 11g not bringing decimals back
							if ($.inArray(criterium.DataType, ['numeric', 'double']) > -1) {
								outputData[i][criterium.Name] = outputData[i][criterium.Name] / 1000000000;
							}
						}
					} else {
						outputData[i][key] = null;
					}
				});
			}
		}
		return outputData;
	}

	/** Build Logical SQL from obiee.BIQuery object */
	function buildLSQL(biQuery) {
		biQuery.SubjectArea = biQuery.defaultSubjectArea();

		var lsql = 'SELECT\n';

		lsql += biQuery.Criteria.map(function(d) {
			var col = parsePresVar(d.Code);

			if (d.DataType == 'numeric' && InsightsConfig.NumericToDouble) {
				col = 'CAST(' + d.Code + ' AS DOUBLE)';
			}

			// Workaround for 11g only which doesn't bring back decimals
			if (wsdl == 'v8') {
				if ($.inArray(d.DataType, ['numeric', 'double']) > -1) {
					col = col + ' * 1000000000';
				}
			}

			return col;
		}).join(',\n');
		lsql += '\nFROM "' + biQuery.SubjectArea + '"';

		if (biQuery.Filters.length > 0) {
			var hasValues = checkFiltersHaveValue(biQuery.Filters);
			if (hasValues) {
				// Copy filter array to prevent incorrect nesting of filter objects in next step
				var filterCopy = [];
				biQuery.Filters.forEach(function(f, i) {
					filterCopy.push($.extend(true, {}, f));
				});

				// If multiple filters exist, assemble into a group
				if (filterCopy.length > 1)
					filterCopy = [new obiee.BIFilterGroup(filterCopy, 'and')];

				lsql += '\nWHERE\n' + buildFilterLSQL(filterCopy);
			}
		}

		lsql += '\nORDER BY '
		if (biQuery.Sort.length == 0)
			lsql += biQuery.Criteria.map(function(d, i) { return (i+1) + ' asc NULLS LAST'; }).join(', ');
		else {
			var sortArray = [];
			for (var i=0; i < biQuery.Sort.length; i++) {
				var position = biQuery.Criteria.map(function(d, j) { if (biQuery.Sort[i].Column.Name == d.Name) return j+1; }); // Get position within array
				position = position.filter(function (d) {return typeof(d) != 'undefined';})[0]; // Reduce array to single element
				sortArray.push(position + ' ' + biQuery.Sort[i].Direction + ' NULLS LAST'); // Build LSQL
			}
			lsql += sortArray.join(', ');
		}

		lsql += '\nFETCH FIRST ' + biQuery.MaxRows + ' ROWS ONLY';
		return lsql;
	}

	/** Build LSQL for filters */
	function buildFilterLSQL(filters, groupOp) {
		var groupOp = groupOp || '';
		var lsqlArray = [];

		for (var i=0; i < filters.length; i++) {
			var filter = filters[i], lsql = "";
			if (filter.Type == 'Filter') { // For group operations
				if (filter.DataType == 'decimal') {
					if (!$.isArray(filter.Value)) {
						filter.Value = [+filter.Value];
					}
				} else if (filter.DataType == 'date') {
					if (!$.isArray(filter.Value)) {
						filter.Value = [filter.Value];
					}
				}

				// Don't filter if no values present except for some operators
				var applyFilter = filter.Value.length > 0 || $.inArray(filter.Operator, ['isNull', 'isNotNull']) > -1;
				if (filter.DataType == 'date' && !filter.Value[0])
					applyFilter = false;

				if (applyFilter) {
					// Escape single quotes in value
					var value;
					if (!$.isArray(filter.Value)) { // Allow both strings and arrays (for IN/NOT IN)
						value = filter.Value.toString().replace(/'/g,"''");
					} else {
						value = [];
						filter.Value.forEach(function(f) {
							value.push(f.toString().replace(/'/g,"''"));
						});
					}

					var valueQuoted = value; // Put quotes around string values

					// Apply quotes if filter is a plain values type
					switch(filter.ValueType) {
						case ('value'):
							switch(filter.DataType) {
								case 'string':
									valueQuoted = "'" + value + "'";
									break;
								case 'date':
									if (value instanceof Date)
										value = d3.time.format('%Y-%m-%d')(value)
									valueQuoted = "date '" + value + "'";
									break;
							}
							break;
						case ('repVar'):
							valueQuoted = 'VALUEOF(' + value + ')';
							break;
						case ('sessionVar'):
							valueQuoted = 'VALUEOF(NQ_SESSION.' + value + ')';
							break;
					}

					switch(filter.Operator) {
						case('equal'):
							lsql = filter.Code + ' = ' + valueQuoted;
							break;
						case ('notEqual'):
							lsql = filter.Code + ' <> ' + valueQuoted;
							break;
						case ('in'):
							lsql = filter.Code + ' in ' + buildInString(filter);
							break;
						case ('notIn'):
							lsql = filter.Code + ' not in ' + buildInString(filter);
							break;
						case ('greater'):
							lsql = filter.Code + ' > ' + valueQuoted;
							break;
						case ('greaterOrEqual'):
							lsql = filter.Code + ' >= ' + valueQuoted;
							break;
						case ('less'):
							lsql = filter.Code + ' < ' + valueQuoted;
							break;
						case ('lessOrEqual'):
							lsql = filter.Code + ' <= ' + valueQuoted;
							break;
						case ('like'):
							lsql = filter.Code + ' LIKE ' + valueQuoted;
							break;
						case ('contains'):
							lsql = filter.Code + ' LIKE ' + "'%" + value + "%'";
							break;
						case ('starts'):
							lsql = filter.Code + ' LIKE ' + "'" + value + "%'";
							break;
						case ('ends'):
							lsql = filter.Code + ' LIKE ' + "'%" + value + "'";
							break;
						case ('top'):
							lsql = 'TOPN(' + filter.Code + ',' + value + ') <= ' + value;
							break;
						case ('bottom'):
							lsql = 'BOTTOMN(' + filter.Code + ',' + value + ') <= ' + value;
							break;
						case('isNull'):
							lsql = filter.Code + ' IS NULL';
							break;
						case('isNotNull'):
							lsql = filter.Code + ' IS NOT NULL';
							break;
						default:
							throw 'Unexpected operator "' + filter.Operator + '". LSQL could not be generated.';
							break;
					}
				}
			} else
				lsql = '(' + buildFilterLSQL(filters[i].Filters, filters[i].Operator) + ')';
			lsqlArray.push(lsql);
		}
		lsqlArray = lsqlArray.filter(function(l) { return l; });
		lsql = lsqlArray.join(' ' + groupOp + ' ');
		return lsql;
	}

	/** Build LSQL string for IN/NOT IN filters */
	function buildInString(filter) {
		var valueArray = filter.Value; // Expects array of values for 'in' filters
		if (typeof(filter.Value) == 'string') // If input is a string, split by ;
			valueArray = filter.Value.split(';');

		valueArray = valueArray.map(function(d) {
			switch(filter.ValueType) {
				case ('value'):
					if (filter.DataType == 'date') {
						if (d instanceof Date)
							d = d3.time.format('%Y-%m-%d')(d)
						return "date '" + d + "'";
					} else if (filter.DataType == 'string') {
						return "'" + d.replace(/'/g,"''") + "'";
					} else
						return d;
					break;
				case ('repVar'):
					return 'VALUEOF(' + d + ')';
					break;
				case ('sessionVar'):
					return 'VALUEOF(NQ_SESSION.' + d + ')'
					break;
				default:
					return d;
					break;
			}
		});

		return '(' + valueArray.join(', ') + ')';
	}

	/** Get short operator for a filter */
	function getShortOperator(operator) {
		var op;

		switch(operator) {
			case('equal'):
				op = '=';
				break;
			default:
				op = '';
				break;
		}

		return op;
	}

	/* ------ END OF INTERNAL QUERY FUNCTIONS ------ */

	/* ------ WEBCAT FUNCTIONS ------ */

	/**
		* Fetches object definitions from a single web catalogue path or folder. Folders will return all of the child
		* elements if required.
		* @param {string} path Web catalogue path to fetch objects from.
		* @param {function} successFunc Callback function to execute on success.
		* @param {function} errFunc Callback function to execute on failure.
		* @param {string} mask Filters on object name, using `*` as a wildcard.
		* @param {integer} permMask Integer representing binary interpretation of object permissions for the user. E.g. 3 for read, 65535 for full control.
		* @param {boolean} includeACL Retrieves the catalogue permissions for the user and attaches it to a property, `permissions`.
		* @param {boolean} rmOnly Only rerieves objects saved by RM Insights. This is identified by the item having a property with name 'RM-Version'.
		* @returns {object[]} Array of web catalogue definitions. Among other things, elements contain: caption (name), description, path, type (object or folder), signature (object type), properties (like version number).
	*/
	obiee.fetchWebcatObjects = function(path, successFunc, errFunc, mask, permMask, includeACL, rmOnly) {
		includeACL = includeACL ? 'True' : 'False';
		mask = mask || '*'; // Default to fetch all objects (no name filter)
		permMask = permMask || 1; // Default to allow only objects with read permissions minimum

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getSubItems>';
		soapMessage += '<'+wsdl+':path>' + path + '</'+wsdl+':path>';
		soapMessage += '<'+wsdl+':mask>' + mask + '</'+wsdl+':mask>';
		soapMessage += '<'+wsdl+':resolveLinks>False</'+wsdl+':resolveLinks>';
		soapMessage += '<'+wsdl+':options>';
        soapMessage += '<'+wsdl+':includeACL>' + includeACL + '</'+wsdl+':includeACL>'
        soapMessage += '<'+wsdl+':withPermission>' + permMask + '</'+wsdl+':withPermission>';
		soapMessage += '<'+wsdl+':withPermissionMask>' + permMask + '</'+wsdl+':withPermissionMask>';
        soapMessage += '<'+wsdl+':withAttributes>False</'+wsdl+':withAttributes>';
		soapMessage += '<'+wsdl+':withAttributesMask>False</'+wsdl+':withAttributesMask>';
        soapMessage += '<'+wsdl+':preserveOriginalLinkPath>False</'+wsdl+':preserveOriginalLinkPath>';
        soapMessage += '</'+wsdl+':options>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':getSubItems></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			outputData = response;
			outputData = outputData.Body.getSubItemsResult.itemInfo;
			if (!outputData)
				outputData = [];

			if ($.isPlainObject(outputData)) // If only one record found, will not automatically be put into an array
				outputData = [outputData];

			outputData.forEach(function(od) {
				if ($.isPlainObject(od.itemProperties))
					od.itemProperties = [od.itemProperties];
			});

			if (includeACL == 'True') {
				outputData.forEach(function(item) {
					var perm = new obiee.BIPermission(item.acl);
					item.permissions = perm.Perms;
				});
			}

			if (rmOnly) {
				outputData = outputData.filter(function(item) {
					var prop = item.itemProperties.filter(function(d) { return d.name == 'RM-Version' });
					return prop.length > 0;
				});
			}

			successFunc(outputData);
		}, function(err) {
			if (errFunc)
				errFunc(err.faultstring);
		});
	};

	/**
		* Fetches available paths from the web catalogue from a list of input paths. Paths will not be returned if there
		* is an error in finding them or if the user does not have read permissions for the respective item.
		* This is useful for identifying permissions when accessing a master list of objects.
		* @param {string[]} paths Web catlaogue paths to retrieve.
		* @param {function} successFunc Callback function to execute on success.
		* @param {function} errFunc Callback function to execute on failure.
		* @returns {string[]} List of paths describing the web catalogue objects that could be fetched.
	*/
	obiee.listWebcatPaths = function(paths, successFunc, errFunc, content) {
		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':readObjects>';
		paths.forEach(function(path) {
			soapMessage += '<'+wsdl+':paths>'+path+'</'+wsdl+':paths>';
		});
		soapMessage += '<'+wsdl+':resolveLinks>False</'+wsdl+':resolveLinks>';
		soapMessage += '<'+wsdl+':errorMode>ErrorCodeAndText</'+wsdl+':errorMode>';
        soapMessage += '<'+wsdl+':returnOptions>NoObject</'+wsdl+':returnOptions>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':readObjects></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			var out = [];
			var results = response.Body.readObjectsResult;
			if (results) {
				if (results.catalogObject) {
					if ($.isPlainObject(results.catalogObject))
						results.catalogObject = [results.catalogObject];
					results.catalogObject.forEach(function(obj) {
						if (!obj.hasOwnProperty('errorInfo')) {
							out.push(obj.itemInfo.path);
						}
					});
				}
				if (out.length > 0) {
					successFunc(out);
				} else {
					errFunc('No available catalogue items.');
				}
			} else {
				errFunc('No available catalogue items.');
			}
		}, errFunc);
	}

	/**
		* Retrieves information for a single web catalogue item.
		* @param {string} path Web catalogue path to fetch objects from.
		* @param {function} successFunc Callback function to execute on success.
		* @param {function} errFunc Callback function to execute on failure.
		* @returns {object} Single web catalogue definition.
	*/
	obiee.getWebcatItem = function(path, successFunc, errFunc) {
		path = sanitiseForXML(path);

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getItemInfo>';
		soapMessage += '<'+wsdl+':path>' + path + '</'+wsdl+':path>';
		soapMessage += '<'+wsdl+':resolveLinks>False</'+wsdl+':resolveLinks>';
        soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':getItemInfo></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			var item = response.Body.getItemInfoResult.return;
			var perm = new obiee.BIPermission(item.acl);
			item.permissions = perm.Perms;
			successFunc(item);
		}, errFunc);
	}

	/**
		* Deletes a web catalogue item or folder at a given path.
		* @param {String} path Web catalogue path to fetch objects from.
		* @param {function} successFunc Callback function to execute on success.
		* @param {function} errFunc Callback function to execute on failure.
	*/
	obiee.deleteWebcatItem = function(path, successFunc, errFunc) {
		path = sanitiseForXML(path);

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':removeFolder>';
		soapMessage += '<'+wsdl+':path>' + path + '</'+wsdl+':path>';
        soapMessage += '<'+wsdl+':recursive>True</'+wsdl+':recursive>';
        soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':removeFolder></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc();
		}, function(err) {
			errFunc(err.faultstring);
		});
	}

	/**
		* Creates a web catalogue folder at a given path. Creates intermediate folders if they do not exist.
		* @param {String} path Web catalogue path to fetch objects from
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute on failure
	*/
	obiee.createWebcatFolder = function(path, successFunc, errFunc) {
		path = sanitiseForXML(path);

		var soapMessage = obieeSOAPHeader()
		soapMessage += '<soapenv:Body><'+wsdl+':createFolder>';
		soapMessage += '<'+wsdl+':path>' + path + '</'+wsdl+':path>';
        soapMessage += '<'+wsdl+':createIfNotExists>True</'+wsdl+':createIfNotExists>';
		soapMessage += '<'+wsdl+':createIntermediateDirs>True</'+wsdl+':createIntermediateDirs>';
        soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':createFolder></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc();
		}, function(err) {
			errFunc(err.faultstring);
		});
	}

	/**
		* Copies a web catalogue item or folder from a given path to another.
		* Security permission of the object is retained through the copy.
		* @param {String} srcPath Web catalogue path to move from.
		* @param {String} destPath Web catalogue path to move to.
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute on failure
	*/
	obiee.copyWebcatItem = function(srcPath, destPath, successFunc, errFunc) {
		srcPath = sanitiseForXML(srcPath);
		destPath = sanitiseForXML(destPath);

		var soapMessage = obieeSOAPHeader()
		soapMessage += '<soapenv:Body><'+wsdl+':copyItem>';
		soapMessage += '<'+wsdl+':pathSrc>' + srcPath + '</'+wsdl+':pathSrc>';
		soapMessage += '<'+wsdl+':pathDest>' + destPath + '</'+wsdl+':pathDest>';
        soapMessage += '<'+wsdl+':flagACL>1</'+wsdl+':flagACL>';
        soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':copyItem></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc();
		}, function(err) {
			errFunc(err.faultstring);
		});
	}

	/**
		* Moves a web catalogue item or folder from a given path to another, this can be used for renaming also.
		* Security permission of the object is retained through the move.
		* @param {String} srcPath Web catalogue path to move from.
		* @param {String} destPath Web catalogue path to move to.
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute on failure
	*/
	obiee.moveWebcatItem = function(srcPath, destPath, successFunc, errFunc) {
		srcPath = sanitiseForXML(srcPath);
		destPath = sanitiseForXML(destPath);

		var soapMessage = obieeSOAPHeader()
		soapMessage += '<soapenv:Body><'+wsdl+':moveItem>';
		soapMessage += '<'+wsdl+':pathSrc>' + srcPath + '</'+wsdl+':pathSrc>';
		soapMessage += '<'+wsdl+':pathDest>' + destPath + '</'+wsdl+':pathDest>';
        soapMessage += '<'+wsdl+':flagACL>1</'+wsdl+':flagACL>';
        soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':moveItem></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc();
		}, function(err) {
			errFunc(err.faultstring);
		});
	}

	/**
		* Renames a web catalogue item or folder, only required a new name to be entered, rather than the full path.
		* Security permission of the object is retained through the move.
		* @param {String} srcPath Full web catalogue path to move from.
		* @param {String} newName New name for the web catalogue item.
		* @param {function} successFunc Callback function to execute on success
		* @param {function} errFunc Callback function to execute on failure
	*/
	obiee.renameWebcatItem = function(srcPath, newName, successFunc, errFunc) {
		var destPath = $.dirFromPath(srcPath) + newName.replace('\/', '\\\/'); // Replace any slashes in file name
		obiee.moveWebcatItem(srcPath, destPath, successFunc, errFunc);
	}

	/**
		* Converts a web catalogue permission mask to a readable object with properties for each permission type.
		* @param {integer} mask Integer version of binary describing the permissions
		* @returns {object} Object with boolean properties `read`, `write`, `delete` etc.
	*/
	obiee.permMaskToObj = function(mask) {
		var binStr = (mask).toString(2); // Convert number to binary string
		var origLen = binStr.length;
		if (origLen < 16 ) {
			for(i = 0; i < 16 - origLen; i++) {
				binStr = '0' + binStr;
			}
		}

		// Convert to an object instead of binary
		var permObj = {
			read: +binStr[15] ? true : false,
			traverse: +binStr[14] ? true : false,
			write: +binStr[13] ? true : false,
			delete: +binStr[12] ? true : false,
			changePerms: +binStr[11] ? true : false,
			changeOwner: +binStr[10] ? true : false,
			runBIP: +binStr[3] ? true : false,
			scheduleBIP: +binStr[4] ? true : false,
			viewBIP: +binStr[5] ? true : false
		}
		return permObj;
	};

	/**
		* Converts a JSON web catalogue permissions object (see `obiee.permMaskToObj`) into
		* the integer equivalent for using with OBIEE web services.
		* @param {object} obj Permissions object with boolean properties describing possible actions.
	*/
	obiee.permObjToMask = function(obj) {
		var binMask = '0000000000000000';

		binMask = binMask.split('');
		binMask[15] = obj.read ? '1' : '0';
		binMask[14] = obj.traverse ? '1' : '0';
		binMask[13] = obj.write ? '1' : '0';
		binMask[12] = obj.delete ? '1' : '0';
		binMask[11] = obj.changePerms ? '1' : '0';
		binMask[10] = obj.changeOwner ? '1' : '0';
		binMask[4] = obj.runBIP ? '1' : '0';
		binMask[3] = obj.scheduleBIP ? '1' : '0';
		binMask[2] = obj.viewBIP ? '1' : '0';

		var out = parseInt(binMask.join(''), 2);

		// Essentially full control as we do not know the hidden permissions
		if (out == 14399)
			out = 65535;
		return out;
	}

	/**
		* Fetches all application roles or users defined in OBIEE
		* @param {function} successFunc Success function passing the returned output.
		* @param {function} errFunc Error handling function passing the error message.
		* @param {string} [mask=*] Search string to only fetch certain records
		* @param {string} [type=2] Choose 1 for users and 2 for application roles.
		* @returns {object[]} Array of objects describing the true name, GUID and display name for each account.
	*/
	obiee.getAccounts = function(successFunc, errFunc, mask, type) {
		mask = mask || '*';
		type = type || 2;

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':getAccounts>';
		soapMessage += '<'+wsdl+':account>';
		soapMessage += '<'+wsdl+':name>'+mask+'</'+wsdl+':name>';
		soapMessage += '<'+wsdl+':accountType>2</'+wsdl+':accountType>';
		soapMessage += '</'+wsdl+':account>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':getAccounts></soapenv:Body></soapenv:Envelope>';

		wsCall('securityService', soapMessage, function(response) {
			var result = response.Body.getAccountsResult.accountDetails;
			successFunc(result);
		}, errFunc);

	};

	/**
		* Updates catalogue item permissions. Completely overwrites the object's permissions.
		* @param {string} path Web catalogue path of the item or folder to update.
		* @param {object[]} acls Array of objects describing the name (`name`), GUID (`guid`) and
		* permissions (`perms`) by application role. Property names indicated in brackets.
		* Permissions can be of object form (see `obiee.permMaskToObj`) or integer.
		* @param {boolean} [recursive=true] Recursively applies the permissions if it is a folder.
		* @param {function} successFunc Success function passing the returned output.
		* @param {function} errFunc Error handling function passing the error message.
	*/
	obiee.updateWebcatPerms = function(path, acls, successFunc, errFunc, recursive) {
		path = sanitiseForXML(path);
		recursive = recursive ? 'True' : 'False';

		soapMessage =  obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':updateCatalogItemACL>';
		soapMessage += '<'+wsdl+':path>'+path+'</'+wsdl+':path>';
		soapMessage += '<'+wsdl+':acl>';

		acls.forEach(function(acl) {
			var perms = acl.perms;
			if ($.isPlainObject(acl.perms))
				perms = obiee.permObjToMask(acl.perms);

			soapMessage += '<'+wsdl+':accessControlTokens><'+wsdl+':account>';
			soapMessage += '<'+wsdl+':name>'+acl.name+'</'+wsdl+':name>';
			soapMessage += '<'+wsdl+':accountType>4</'+wsdl+':accountType>'; // 4 for Application Role
			soapMessage += '<'+wsdl+':guid>'+acl.guid+'</'+wsdl+':guid>'
			soapMessage += '</'+wsdl+':account>';
            soapMessage += '<'+wsdl+':permissionMask>'+perms+'</'+wsdl+':permissionMask>';
			soapMessage += '</'+wsdl+':accessControlTokens>';
		});

		soapMessage += '</'+wsdl+':acl><'+wsdl+':options>';
		soapMessage += '<'+wsdl+':updateFlag>0</'+wsdl+':updateFlag>'; // 0 replaces all permissions with the new ACLs
		soapMessage += '<'+wsdl+':recursive>'+recursive+'</'+wsdl+':recursive>';
		soapMessage += '</'+wsdl+':options>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':updateCatalogItemACL></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc(response);
		}, errFunc);
	}

	/**
		* Sets or unsets item attribtues for a web catalogue item using the following index:
		* 1 = Read Only, 2 = Archive 4 = Hidden 8 = System. A combination can be used, e.g.
		* 12 for hidden and system.
		* @param {string} path Web catalogue path of the item or folder to update.
		* @param {integer} [set=0] Attribute index to apply using the index described above.
		* @param {integer} [unset=0] Attribute index to remove using the index described above.
		* @param {function} [successFunc] Success function passing the returned output.
		* @param {function} [errFunc] Error handling function passing the error message.
	*/
	obiee.setWebcatAttribute = function(path, set, unset, successFunc, errFunc) {
		set = set || 0;
		unset = unset || 0;
		successFunc = successFunc || function() {};
		errFunc = errFunc || function() {};
		path = sanitiseForXML(path);

		soapMessage =  obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':setItemAttributes>';
		soapMessage += '<'+wsdl+':path>'+path+'</'+wsdl+':path>';
        soapMessage += '<'+wsdl+':value>'+set+'</'+wsdl+':value>';
        soapMessage += '<'+wsdl+':valueOff>'+unset+'</'+wsdl+':valueOff>';
        soapMessage += '<'+wsdl+':recursive>False</'+wsdl+':recursive>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':setItemAttributes></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc(response);
		}, errFunc);
	}

	/**
		* Sets or unsets item property for a web catalogue item using a key-value pair.
		* @param {string} path Web catalogue path of the item or folder to update.
		* @param {integer} name Name of the property to apply.
		* @param {integer} value Value of the property to apply;
		* @param {function} [successFunc] Success function passing the returned output.
		* @param {function} [errFunc] Error handling function passing the error message.
	*/
	obiee.setWebcatProperty = function(path, name, value, successFunc, errFunc) {
		path = sanitiseForXML(path);
		successFunc = successFunc || function() {};
		errFunc = errFunc || function() {};

		soapMessage =  obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':setItemProperty>';
		soapMessage += '<'+wsdl+':path>'+path+'</'+wsdl+':path>';
		soapMessage += '<'+wsdl+':name>'+name+'</'+wsdl+':name>';
        soapMessage += '<'+wsdl+':value>'+value+'</'+wsdl+':value>';
        soapMessage += '<'+wsdl+':recursive>False</'+wsdl+':recursive>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':setItemProperty></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			successFunc(response);
		}, errFunc);
	}

	/**
		* Adds a web catlaogue folder to the master list of published dashboards.
		* This list (JSON) is stored in the web catalogue at /shared/RM-Insights/Published-Dashboards.
		* This is hidden by default but all users have read access and any users with the RM 'create' permission
		* have write access. All available files in the directory are presented as dashboard pages.
		* @param {string} [path] Web catalogue path of the dashboard to publish.
		* @param {string} [desc] Description of the dashboard. Note that this is separate to the
		* catalogue description and essentially renders that one irrelevant for Insights dashboards.
		* @param {object} [tags] Array of words indicating the tags for the dashboard.
		* @param {string} [icon] Font Awesome icon reference for the dashboard.
		* @param {function} [successFunc] Success callback function.
		* @param {function} [errFunc] Error handling function passing the error message.
	*/
	obiee.publishDB = function(path, desc, tags, icon, successFunc, errFunc) {
		path = sanitiseForXML(path);
		successFunc = successFunc || function() {};
		errFunc = errFunc || function() {};
		var dbList, db;

		if (path)
			db = { 'path': path, 'icon': icon, 'desc': desc, 'tags': tags, 'name' : $.fileFromPath(path) };

		// Asynchronously updates the RM-Dashboard property on the folder to true
		function updateProperty(path, successFunc, errFunc) {
			if (path)
				obiee.setWebcatProperty(path, 'RM-Dashboard', 1, successFunc, errFunc)
		}

		// Fetch existing list
		if (db) {
			obiee.getPublishedDBs(function(results) {
				dbList = results;
				var find = results.filter(function(r) {
					return r.path == path;
				});

				// Update if it already exists
				if (find.length > 0)
					dbList[$.inArray(find[0], results)] = db;
				else
					dbList.push(db);
				writeDBList(dbList, function() {
					updateProperty(path, successFunc, errFunc);
				}, errFunc);
			}, function() { // Recreate a new one if it doesn't exist or is corrupted
				dbList = [db]
				writeDBList(dbList, function() {
					updateProperty(path, successFunc, errFunc);
				}, errFunc);
			});
		} else { // Creates a blank file
			dbList = [];
			writeDBList(dbList, successFunc, errFunc);
		}
	};

	/**
		* Unpublish dashboard by removing the path from the master list.
		* @param {string} path Web catalogue path of the dashboard to unpublish.
		* @param {function} [successFunc] Success callback function.
		* @param {function} [errFunc] Error handling function passing the error message.
	*/
	obiee.unpublishDB = function(path, successFunc, errFunc) {
		path = sanitiseForXML(path);
		successFunc = successFunc || function() {};
		errFunc = errFunc || function() {};
		obiee.getPublishedDBs(function(dbList) {
			if (dbList) {
				var find = dbList.filter(function(r) {
					return r.path == path;
				});

				if (find.length > 0)
					$.removeFromArray(find[0], dbList);
				writeDBList(dbList, function() {
					obiee.setWebcatProperty(path, 'RM-Dashboard', 0, successFunc, errFunc);
				}, errFunc);
			} else
				successFunc();
		});
	}

	/**
		* Retrieves list of published dashboards from the catalogue.
		* @param {function} successFunc Success callback function.
		* @param {boolean} securityFilter If true, the function will only return paths
		* the user has access to.
		* @param {object[]} Array of objects describing the published dashboards.
	*/
	obiee.getPublishedDBs = function(successFunc, securityFilter) {
		securityFilter = securityFilter || false;
		loadXML('/shared/RM-Insights/Published-Dashboards', function(analysisObj) {
			// Get the RMVPP view
			for (var i=0; i < analysisObj.views.view.length; i++) {
				view = analysisObj.views.view[i];
				if (view.name == 'rmvppView') {
					html = view.staticText.caption.text[0];
				}
			}

			// Extract the JSON object using regex
			re = new RegExp('\/\\* Dashboard List \\*\/.* = (.*?)\/\\* End of Dashboard List \\*\/');
			var publishedDBs;
			if (re.exec(html)) {
				publishedDBs = re.exec(html)[1];
				publishedDBs = JSON.parse(publishedDBs);

				// Filter dashboard list based on security
				if (securityFilter) {
					var paths = publishedDBs.map(function(db) { return db.path; });
					obiee.listWebcatPaths(paths, function(filteredPaths) {
						publishedDBs = publishedDBs.filter(function(db) {
							return $.inArray(db.path, filteredPaths) > -1;
						})
						successFunc(publishedDBs);
					}, function() {
						successFunc([]);
					});
				} else
					successFunc(publishedDBs);
			} else {
				obiee.publishDB(); // Create a new list
				successFunc([]);
			}
		}, function () {
			obiee.publishDB(); // Recreate a new list
			successFunc([]);
		});
	};

	/** Writes the list of dashboards to the web catalogue. */
	function writeDBList(list, successFunc, errFunc) {
		// Build html inputing the JSON object
		var html = '<script>'
		html += '\n\t' + '/* Dashboard List */ var res1 = ' + JSON.stringify(list) + '/* End of Dashboard List */';
		html += '</script>';
		var htmlView = buildHTMLViewXML(html);
		var compoundView = buildCompoundViewXML('rmvppView');

		var dummyCol = new obiee.BIColumn("'Dummy'", 'Dummy');
		var dummyQuery = new obiee.BIQuery([dummyCol]); // No need for filters or sort
		var xml = buildXML(dummyQuery, [htmlView, compoundView]) // Use the first visualisation as the criteria. Arbitrary here anyway.

		// Security based on system configuration: read for those with view, full for those with create

		var acls = [
			{ name: InsightsConfig.Security['view'], perms: 3 },
			{ name: InsightsConfig.Security['create'], perms: 65535 },
		];

		saveXML(xml, '/shared/RM-Insights/Published-Dashboards', successFunc, errFunc, acls);
	}

	/** Save XML back to the Webcat */
	function saveXML(xml, path, successFunc, errFunc, acls) {
		path = sanitiseForXML(path);

		soapMessage =  obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':writeObjects><'+wsdl+':catalogObjects><'+wsdl+':catalogObject>';
		soapMessage += '<![CDATA[<?xml version="1.0"?>' + xml + ']]>';
		soapMessage += '</'+wsdl+':catalogObject><'+wsdl+':itemInfo><'+wsdl+':path>' + path;
		soapMessage += '</'+wsdl+':path><'+wsdl+':type>Object</'+wsdl+':type>';
		soapMessage += '<'+wsdl+':attributes>4</'+wsdl+':attributes>'; // Hide RM-Insights files from vanilla OBIEE
		soapMessage += '<'+wsdl+':signature>queryitem1</'+wsdl+':signature>'
		soapMessage += '<'+wsdl+':itemProperties><'+wsdl+':name>RM-Version</'+wsdl+':name><'+wsdl+':value>' + rmVersion + '</'+wsdl+':value></'+wsdl+':itemProperties>'; // Add RM version number

		if (acls) {
			soapMessage += '<'+wsdl+':acl>';
			acls.forEach(function(acl) {
				soapMessage += '<'+wsdl+':accessControlTokens><'+wsdl+':account>';
				soapMessage += '<'+wsdl+':name>'+acl.name+'</'+wsdl+':name>';
				soapMessage += '<'+wsdl+':accountType>4</'+wsdl+':accountType>';
				soapMessage += '<'+wsdl+':guid>'+acl.name+'</'+wsdl+':guid>'; // Assumes GUID == name
				soapMessage += '</'+wsdl+':account>';
				soapMessage += '<'+wsdl+':permissionMask>'+acl.perms+'</'+wsdl+':permissionMask>';
				soapMessage += '</'+wsdl+':accessControlTokens>';
			});
			soapMessage += '</'+wsdl+':acl>';
		}

		soapMessage += '</'+wsdl+':itemInfo>';
		soapMessage += '</'+wsdl+':catalogObjects><'+wsdl+':allowOverwrite>TRUE</'+wsdl+':allowOverwrite><'+wsdl+':createIntermediateDirs>TRUE</'+wsdl+':createIntermediateDirs><'+wsdl+':errorMode>FullDetails</'+wsdl+':errorMode>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':writeObjects></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			jsonResponse = response;

			result = jsonResponse.Body.writeObjectsResult;
			if (typeof(result) == 'object') {
				if (errFunc && result.errorInfo)
					errFunc(result.errorInfo.message);
				else
					successFunc(response);
			} else
				successFunc(response);
		});
	}

	/** Load XML from a Webcat path */
	function loadXML(path, successFunc, errFunc) {
		path = sanitiseForXML(path);

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Body><'+wsdl+':readObjects><'+wsdl+':paths>';
		soapMessage += path + '</'+wsdl+':paths><'+wsdl+':resolveLinks>FALSE</'+wsdl+':resolveLinks><'+wsdl+':errorMode>FullDetails</'+wsdl+':errorMode><'+wsdl+':returnOptions>ObjectAsString</'+wsdl+':returnOptions>';
		soapMessage += '<'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':readObjects></soapenv:Body></soapenv:Envelope>';

		wsCall('webCatalogService', soapMessage, function(response) {
			rawResponse = response;
			analysisObj = rawResponse.Body.readObjectsResult.catalogObject.catalogObject

			// Throw error if object does not exist
			if (analysisObj == "") {
				var err = rawResponse.Body.readObjectsResult.catalogObject.errorInfo;
				if (errFunc) {
					if (err)
						errFunc(err.message);
					else
						errFunc(path + ' not an Analysis');
				}
			} else {
				analysisObj = $.xml2json(analysisObj);
				successFunc(analysisObj);
			}
		}, errFunc);
	}

	/** Build visualisation HTML */
	function visualisationHTML(dbObj) {
		var html = '';
		var hasFilters = !$.isEmptyObject(dbObj.Prompts)
		var hasInts = dbObj.Interactions.length > 0;
		var hasDrills = dbObj.Drilldowns.length > 0;
		var hasSelectors = dbObj.ColumnSelectors.length > 0;
		var hasVisSelectors = dbObj.VisualSelectors.length > 0;
		var hasCanvas = dbObj.Canvas.Element ? dbObj.Canvas.Element.toJSON().objects.length > 0 : false;
		var visMap = {}; // Map new vis number with original ones

		html += '\n<script id="insightsLogic">'; // Main script tag

		// JS object for visualisations
		html += '\n\n\tvar biVisArray = [], biHiddenVisArray = [], biSelectors = [], biVisSelectors = [], biInteractions = [], biDrilldowns = [], biUtilities = [], biPrompt = {}, biDB = new obiee.BIDashboardPage();';
		for (var i=0; i < dbObj.Visuals.length; i++) {
			var inc = i+1;
			html += '\n\t' + '/* Visualisation ' + inc + ' */ var biVis' + inc + ' = ' + JSON.stringify(dbObj.Visuals[i]) + '/* End of Visualisation ' + inc + ' */';
		}

		for (var i=0; i < dbObj.HiddenVisuals.length; i++) {
			var inc = i+1;
			html += '\n\t' + '/* Hidden ' + inc + ' */ var biHidden' + inc + ' = ' + JSON.stringify(dbObj.HiddenVisuals[i]) + '/* End of Hidden ' + inc + ' */';
		}

		html += '\n\n\tbiDB.Visuals = biVisArray;';

		// JS for global filters
		if (hasFilters) {
			html += '\n';
			html += '\n\t' + '/* Global Filter */ biPrompt = ' + JSON.stringify(dbObj.Prompts) + '/* End of Global Filter */'; // JS object
			html += '\n\n\tbiDB.Prompts = biPrompt;';
		}

		// JS for column selectors
		if (hasSelectors) {
			html += '\n';
			for (var i=0; i < dbObj.ColumnSelectors.length; i++) {
				var inc = +i+1, search;
				html += '\n\t' + '/* Column Selector ' + inc + ' */ var biSel' + inc + ' = ' + JSON.stringify(dbObj.ColumnSelectors[i]) + '/* End of Column Selector ' + inc + ' */'; // JS object
				html += '\n\t' + 'biSelectors.push(biSel' + inc + ');';
			}
			html += '\n\n\tbiDB.ColumnSelectors = biSelectors;';
		}

		// JS for visual selectors
		if (hasVisSelectors) {
			html += '\n';
			for (var i=0; i < dbObj.VisualSelectors.length; i++) {
				var inc = +i+1, search;
				html += '\n\t' + '/* Visual Selector ' + inc + ' */ var biVisSel' + inc + ' = ' + JSON.stringify(dbObj.VisualSelectors[i]) + '/* End of Visual Selector ' + inc + ' */'; // JS object
				html += '\n\t' + 'biVisSelectors.push(biVisSel' + inc + ');';
			}
			html += '\n\n\tbiDB.VisualSelectors = biVisSelectors;';
		}

		// JS for interactions
		if (hasInts) {
			html += '\n';

			// Rebuild interaction objects rather than storing them as with others
			// This is because interaction objects contain superfluous information that needn't be stored twice
			for (var i=0; i < dbObj.Interactions.length; i++) {
				var inc = i+1;

				// Explicitly store a cut-down information object
				var simpleInteract = {
					'Trigger' : dbObj.Interactions[i].Trigger,
					'SourceNum' : dbObj.Interactions[i].SourceNum,
					'TargetNum' : dbObj.Interactions[i].TargetNum,
					'Action' : dbObj.Interactions[i].Action,
					'Columns' : dbObj.Interactions[i].Columns
				}

				html += '\n\t/* Interaction ' + inc + ' */ var biInt' + inc + ' = ' + JSON.stringify(simpleInteract) + '/* End of Interaction ' + inc + ' */'; // JS object

				// Create new obiee.BIInteraction object
				html += '\n\tinteraction = new obiee.BIInteraction (';
				html += 'biVisArray[' + dbObj.Interactions[i].SourceNum + '], ';
				html += 'biVisArray[' + dbObj.Interactions[i].TargetNum + '], ';
				html += '"' + dbObj.Interactions[i].Trigger + '", ';
				html += '"' + dbObj.Interactions[i].Action + '", ';
				html += 'biInt' + inc + '.Columns);';

				html += '\n\tbiInteractions.push(interaction);\n';
			}

			html += '\n\tbiDB.Interactions = biInteractions;';
		}

		// JS for drilldowns
		if (hasDrills) {
			html += '\n';

			// Rebuild interaction objects rather than storing them as with others
			// This is because interaction objects contain superfluous information that needn't be stored twice
			for (var i=0; i < dbObj.Drilldowns.length; i++) {
				var inc = i+1;

				// Explicitly store a cut-down information object
				var simpleDrill = {
					'Trigger' : dbObj.Drilldowns[i].Trigger,
					'SourceNum' : dbObj.Drilldowns[i].SourceNum,
					'DrillPath' : dbObj.Drilldowns[i].DrillPath,
					'Columns' : dbObj.Drilldowns[i].Columns
				}

				html += '\n\t/* Drilldown ' + inc + ' */ var biDrill' + inc + ' = ' + JSON.stringify(simpleDrill) + '/* End of Drilldown ' + inc + ' */'; // JS object
				html += '\n\tdrill = new obiee.BIDrilldown (biVisArray[biDrill' + inc + '.SourceNum], biDrill' + inc + '.DrillPath, biDrill' + inc + '.Trigger, biDrill' + inc + '.Columns, "' + dbObj.Path + '");'
				html += '\n\tbiDrilldowns.push(drill);\n';
			}
			html += '\n\tbiDB.Drilldowns = biDrilldowns;';
		}

		// JS for canvas
		if (hasCanvas) {
			dbObj.Canvas.Element.includeDefaultValues = false;
			var canvasJSON = dbObj.Canvas.Element.toJSON();
			canvasJSON = cleanCanvasJSON(canvasJSON);
			html += '\n\t' + '/* Canvas 1 */ var biCanvas1 = ' + JSON.stringify(canvasJSON) + '/* End of Canvas 1 */';
		}

		// JS to store original resolution
		var res = {
			width: window.screen.availWidth,
			height: window.screen.availHeight
		};
		html += '\n\t' + '/* Resolution 1 */ var res1 = ' + JSON.stringify(res) + '/* End of Resolution 1 */';

		html += '\n</script>'; // Close for #insightsLogic
		html = escapeBadXML(html);
		return html;
	}

	/** Escape bad XML characters */
	function escapeBadXML(xml) {
		xml = xml.replace(/&/g, '&amp;');
		return xml;
	}

	/** Convert report XML to obiee.BIFilter objects */
	function convertFilter(filter) {
		if (filter["xsi:type"] != 'sawx:logical') {
			code = filter.expr[0].text;
			value = filter.expr[1].text;
			type = filter.expr[1]["xsi:type"].replace('xsd:','');
			biFilter = new obiee.BIFilter(code, value, filter.op, type);
			return biFilter;
		} else {
			var subFilter = filter.expr;
			var filterList = [];
			for (var j=0; j < subFilter.length; j++) {
				filterList.push(convertFilter(subFilter[j]));
			}
			var biFilterGroup = new obiee.BIFilterGroup(filterList, filter.op);
			return biFilterGroup;
		}
	}

	/* ------ END OF WEBCAT FUNCTIONS ------ */

	/* ------ PUBLIC RMVPP FUNCTIONS ------ */

	/** Wrapper for the map data function accomodating for multiple datasets. */
	function mapDataMulti(data, vis) {
		return obiee.applyToColumnSets({}, vis.Plugin, function(item, dataset) {
			if (dataset) {
				return mapData(data[dataset], vis.ColumnMap[dataset]);
			} else {
				return mapData(data, vis.ColumnMap);
			}
		});
	}

	/** Function to rename data properties based on column map for a specific visualisation */
	function mapData(data, columnMap) {
		if (!$.isArray(data)) {
			data = [];
		}

		for (var i=0; i < data.length; i++) {
			for (prop in columnMap) {
				if ($.isArray(columnMap[prop])) { // For grouped attributes, transform to sub-array
					var valueArray = [];
					for (var j=0; j < columnMap[prop].length; j++) {
						value = {'name' : columnMap[prop][j].Name, 'value' : data[i][columnMap[prop][j].Name]};
						if ($.inArray(columnMap[prop][j].DataType, ['integer', 'double', 'numeric']) > -1) {
							value.value = +value.value;
						}
						valueArray.push(value);
					}
					data[i][prop] = valueArray;
				} else {
					if ('Name' in columnMap[prop]) {
						data[i] = renameProperty(data[i], columnMap[prop].Name, prop);
					}

					if ($.inArray(columnMap[prop].DataType, ['integer', 'double', 'numeric']) > -1) {
						data[i][prop] = +data[i][prop];
					}
				}
			}
		}
		return data;
	}

	/** Cleanup any inconsistent objects in the dashboard before saving */
	function cleanupDashboard(db) {
		db.Visuals.forEach(function(vis, i) {
			vis.ID = i;
			vis.resetColumnConfig(true);
		});

		// Remove any interactions if their visualisations are not present in the dashboard page
		var removeInts = [];
		db.Interactions.forEach(function(int) {
			int.SourceNum = int.SourceVis.ID;
			int.TargetNum = int.TargetVis.ID;
			if ($.inArray(int.SourceVis, db.Visuals) == -1)
				removeInts.push(int);
			else if ($.inArray(int.TargetVis, db.Visuals) == -1)
				removeInts.push(int);
		});
		removeInts.forEach(function(int) {
			$.removeFromArray(int, db.Interactions);
		})

		// Remove any dashbaord filter values
		if (db.Prompts.Filters) {
			db.Prompts.Filters.forEach(function(filter) {
				if (filter.DataType == 'string')
					filter.Value = [];
			});
		}
	}

	/**
		* Asynchronously loads a visualisation from the catalogue as a `BIDashboardPage` object.
		* @param {String} path Web catalogue path to load RM Analytics dashboard from.
		* @param {function} successFunc Callback function to execute upon success.
		* @param {function} successFunc Callback function to execute upon error.
		* @returns {BIDashboardPage} Object describing  an entire analytics dashboard, including interactivity.
	*/
	obiee.loadDB = function(path, successFunc, errFunc) {
		var html;
		loadXML(path, function(analysisObj) {
			// Get the RMVPP view
			for (var i=0; i < analysisObj.views.view.length; i++) {
				view = analysisObj.views.view[i];
				if (view.name == 'rmvppView') {
					html = view.staticText.caption.text[0];
				}
			}

			if (html) {
				var numMatches, visArray = [], hiddenVisArray = [], selectorArray = [], visSelectorArray = [], filterObj = {}
				var interactions = [], drilldowns = [];

				function processVis(re, html, inpVisArray) {
					if (re.exec(html)) {
						visObj = re.exec(html)[1];
						visObj = JSON.parse(visObj);

						visObj.Query = obiee.applyToColumnSets(visObj.Query, visObj.Plugin, function(query, dataset) {
							query.Criteria.forEach(function(c, i) {
								var newCol = new obiee.BIColumn(c.Code, c.Name, c.DataType, c.Table, c.Measure, c.SubjectArea, c.DataFormat);
								newCol.SortKey = c.SortKey;
								query.Criteria[i] = newCol;
							});

							query.Filters.forEach(function(f, i) {
								if (f.DataType == 'date' && f.ValueType == 'value') {
									if (f.Value) {
										f.Value = new Date(f.Value);
									} else {
										f.Value = null;
									}
								}
							});
							return query;
						});

						// Protects saved visualisations when new multiple column parameters added
						// Needs to work for both plugins supporting multiple datasets as well as single ones
						var defaultMap = rmvpp.getDefaultColumnMap(visObj.Plugin);
						visObj.ColumnMap = obiee.applyToColumnSets(visObj.ColumnMap, visObj.Plugin, function(colMap, dataset) {
							if (dataset) {
								for (col in defaultMap[dataset]) {
									if (!(col in colMap)) {
										var colObj = rmvpp.Plugins[visObj.Plugin].columnMappingParameters[dataset].filter(function(c) {
											return c.targetProperty == col;
										})[0];
										if (colObj.multiple) {
											colMap[col] = []
										}
									}
								}
							} else {
								for (col in defaultMap) {
									if (!(col in colMap)) {
										var colObj = rmvpp.Plugins[visObj.Plugin].columnMappingParameters.filter(function(c) {
											return c.targetProperty == col;
										})[0];
										if (colObj.multiple) {
											colMap[col] = []
										}
									}
								}
							}
							return colMap;
						});

						// Re-initialise each column, protects against BIColumn framework updates
						visObj.ColumnMap = obiee.applyToColumnSets(visObj.ColumnMap, visObj.Plugin, function(colMap, dataset) {
							for (col in colMap) {
								var cm = colMap[col];
								if ($.isArray(cm)) { // Handle multiple columns
									cm.forEach(function(c, i) {
										var newCol = new obiee.BIColumn(c.Code, c.Name, c.DataType, c.Table, c.Measure, c.SubjectArea, c.DataFormat, c.Config, c.Locale);
										newCol.SortKey = c.SortKey;
										colMap[col][i] = newCol;
									});
								} else {
									var newCol = new obiee.BIColumn(cm.Code, cm.Name, cm.DataType, cm.Table, cm.Measure, cm.SubjectArea, cm.DataFormat, cm.Config, cm.Locale);
									newCol.SortKey = cm.SortKey;
									colMap[col] = newCol;
								}
							}
							return colMap;
						});

						var biQuery = obiee.applyToColumnSets({}, visObj.Plugin, function(item, dataset) {
							if (dataset) {
								return new obiee.BIQuery(visObj.Query[dataset].Criteria, visObj.Query[dataset].Filters, visObj.Query[dataset].Sort);
							} else {
								return new obiee.BIQuery(visObj.Query.Criteria, visObj.Query.Filters, visObj.Query.Sort);
							}
						});

						// Refresh conditional formats
						visObj.ConditionalFormats.forEach(function(cf, i) {
							var newCF = new obiee.BIConditionalFormat(cf.SourceID, cf.TargetID, cf.Value, cf.Operator, cf.Style, visObj.ColumnMap, cf.Dataset);
							visObj.ConditionalFormats[i] = newCF;
						});

						// var prompt = visObj.Prompt

						visObj = new obiee.BIVisual(visObj.Plugin, visObj.Config, visObj.ColumnMap, biQuery, visObj.X, visObj.Y,
													visObj.ID, visObj.Name, visObj.ConditionalFormats, visObj.DisplayName);
						visObj = rmvpp.tidyConfig(visObj) // Fill in any missing configuration parameters with defaults
						inpVisArray.push(visObj);
					}
					return inpVisArray;
				}

				// Search for visualisations
				numMatches = html.match(/\/\* Visualisation /g);
				if ($.isEmptyObject(numMatches))
					throw 'No RMVPP Visualisation found in: ' + path;
				else
					numMatches = numMatches.length;

				// Loop over visualisations
				for (var i=0; i < numMatches; i++) {
					var inc = i+1;
					re = new RegExp('\/\\* Visualisation ' + inc + ' \\*\/.*? = (.*?)\/\\* End of Visualisation ' + inc + ' \\*\/'); // Extract the obiee.BIVisual object using regex
					visArray = processVis(re, html, visArray);
				}

				// Search for hidden visualisations
				numMatches = html.match(/\/\* Hidden /g);
				if (!$.isEmptyObject(numMatches)) {
					numMatches = numMatches.length;
					for (var i=0; i < numMatches; i++) {
						var inc = i+1;
						re = new RegExp('\/\\* Hidden ' + inc + ' \\*\/.*? = (.*?)\/\\* End of Hidden ' + inc + ' \\*\/'); // Extract the obiee.BIVisual object using regex
						hiddenVisArray = processVis(re, html, hiddenVisArray);
					}
				}

				// Search for global filters
				re = new RegExp('\/\\* Global Filter \\*\/.*? = (.*?)\/\\* End of Global Filter \\*\/'); // Extract filter object using regex
				if (!$.isEmptyObject(re.exec(html))) {
					filterObj = re.exec(html)[1];
					filterObj = JSON.parse(filterObj);
					filterObj.Filters.forEach(function(f) {
						if (f.DataType == 'date') {
							f.PromptOptions.DefaultValues.forEach(function(dv) {
								if (dv.ValueType == 'value')
									dv.Value = dv.Value ? new Date(dv.Value) : null;
							});
						}
					})
					filterObj = new obiee.BIPrompt(filterObj.Filters, filterObj.X, filterObj.Y);
				}

				// Column Selectors
				numMatches = html.match(/\/\* Column Selector /g);
				if (!$.isEmptyObject(numMatches)) {
					for (var i=0; i < numMatches.length; i++) {
						var inc = +i+1;
						re = new RegExp('\/\\* Column Selector ' + inc + ' \\*\/.* = (.*?)\/\\* End of Column Selector ' + inc + ' \\*\/'); // Extract the interaction object using regex
						var selector;
						if (re.exec(html)) {
							selector = re.exec(html)[1];
							selector = JSON.parse(selector);
							selector = new obiee.BIColumnSelector(selector.Columns, selector.Visuals, selector.X, selector.Y, selector.Style);
							selectorArray.push(selector);
						}
					}
				}

				// Visual Selectors
				numMatches = html.match(/\/\* Visual Selector /g);
				if (!$.isEmptyObject(numMatches)) {
					for (var i=0; i < numMatches.length; i++) {
						var inc = +i+1;
						re = new RegExp('\/\\* Visual Selector ' + inc + ' \\*\/.* = (.*?)\/\\* End of Visual Selector ' + inc + ' \\*\/'); // Extract the interaction object using regex
						var selector;
						if (re.exec(html)) {
							selector = re.exec(html)[1];
							selector = JSON.parse(selector);
							selector = new obiee.BIVisualSelector(selector.Visuals, selector.X, selector.Y, selector.Style, selector.Selected, selector.Default);
							visSelectorArray.push(selector);
						}
					}
				}

				// Interactions
				numMatches = html.match(/\/\* Interaction /g);
				if (!$.isEmptyObject(numMatches)) {
					for (var i=0; i < numMatches.length; i++) {
						var inc = i+1;
						re = new RegExp('\/\\* Interaction ' + inc + ' \\*\/.* = (.*?)\/\\* End of Interaction ' + inc + ' \\*\/'); // Extract the interaction object using regex

						var interaction;
						if (re.exec(html)) {
							interaction = re.exec(html)[1];
							interaction = JSON.parse(interaction);
							interaction = new obiee.BIInteraction(visArray[interaction.SourceNum], visArray[interaction.TargetNum], interaction.Trigger, interaction.Action, interaction.Columns);
							interactions.push(interaction);
						}
					}
				}

				// Drilldowns
				numMatches = html.match(/\/\* Drilldown /g);
				if (!$.isEmptyObject(numMatches)) {
					for (var i=0; i < numMatches.length; i++) {
						var inc = i+1;
						re = new RegExp('\/\\* Drilldown ' + inc + ' \\*\/.* = (.*?)\/\\* End of Drilldown ' + inc + ' \\*\/'); // Extract the interaction object using regex

						var drilldown;
						if (re.exec(html)) {
							drilldown = re.exec(html)[1];
							drilldown = JSON.parse(drilldown);
							drilldown = new obiee.BIDrilldown(visArray[drilldown.SourceNum], drilldown.DrillPath, drilldown.Trigger, drilldown.Columns, path);
							drilldowns.push(drilldown);
						}
					}
				}

				// Canvas
				re = new RegExp('\/\\* Canvas 1 \\*\/.* = (.*?)\/\\* End of Canvas 1 \\*\/'); // Extract the canvas object using regex
				var canvas;
				if (re.exec(html)) {
					canvas = re.exec(html)[1];
					canvas = JSON.parse(canvas);
					canvas = cleanCanvasJSON(canvas);
					canvas = new obiee.BICanvas(canvas, false, canvas.Width, canvas.Height);
				}

				// Resolution
				re = new RegExp('\/\\* Resolution 1 \\*\/.* = (.*?)\/\\* End of Resolution 1 \\*\/'); // Extract the resolution object using regex
				var origRes;
				if (re.exec(html)) {
					origRes = re.exec(html)[1];
					origRes = JSON.parse(origRes);

					if (!$.isEmptyObject(origRes)) {
						var widthRatio = (window.screen.availWidth / origRes.width)
						var heightRatio = (window.screen.availHeight / origRes.height);
						var meanRatio = d3.mean([widthRatio, heightRatio]);

						function translateObj(obj, wRatio, hRatio) {
							obj.X = Math.round(obj.X * wRatio);
							obj.Y = Math.round(obj.Y * hRatio);
							return obj;
						}

						function scaleObj(obj, wRatio, hRatio) {
							obj.width = Math.round(obj.width * wRatio);
							obj.height = Math.round(obj.height * hRatio);
							return obj;
						}

						// Scale dashboard visualisations based on screen resolution difference
						visArray.forEach(function(vis) {
							vis = translateObj(vis, widthRatio, heightRatio);

							// Scale custom parameters
							rmvpp.Plugins[vis.Plugin].configurationParameters.forEach(function(param) {

								// Exclude special size parameters and any that don't have scalabe set
								if ($.inArray(param.targetProperty, ['size', 'width', 'height']) == -1 && param.scalable) {
									var configVal = vis.Config[param.targetProperty];
									switch(param.scalable) {
										case 'size':
											configVal = Math.round(configVal * meanRatio);
											break;
										case 'width':
											configVal = Math.round(configVal * widthRatio);
											break;
										case 'height':
											configVal = Math.round(configVal * heightRatio);
											break;
									}
								}
							});

							if (vis.Config.size) {
								vis.Config.size = Math.round(vis.Config.size * meanRatio);
							} else {
								vis.Config = scaleObj(vis.Config, widthRatio, heightRatio);
							}
						});

						// Prompts
						if (!$.isEmptyObject(filterObj)) {
							filterObj = translateObj(filterObj, widthRatio, heightRatio);
						};

						// Column Selectors
						selectorArray.forEach(function(selector) {
							selector = translateObj(selector, widthRatio, heightRatio);
						});

						// Visual Selectors
						visSelectorArray.forEach(function(selector) {
							selector = translateObj(selector, widthRatio, heightRatio);
						});

						// Canvas
						if (canvas) {
							canvas.JSON.objects.forEach(function(cObj) {
								if (cObj.type == 'i-text') { // Alter font size for text
									cObj.fontSize = (cObj.fontSize ? cObj.fontSize : 40) * meanRatio;
								} else if (cObj.type == 'image') { // Maintain aspect ratio for images
                                    cObj.scaleX = cObj.scaleX * meanRatio;
                                    cObj.scaleY = cObj.scaleY * meanRatio;
                                } else {
									if (cObj.width == cObj.height) { // Preserve ratio
										cObj.scaleX = meanRatio;
										cObj.scaleY = meanRatio;
									} else {
										cObj.scaleX = widthRatio;
										cObj.scaleY = heightRatio;
									}
								}

								cObj.left = cObj.left * widthRatio;
								cObj.top = cObj.top * heightRatio;
							});
						}
					}
				}

				var dbObj = new obiee.BIDashboardPage(visArray, filterObj, interactions, selectorArray, drilldowns, path, [], visSelectorArray, canvas, hiddenVisArray);

				// Apply default column selectors before it loads
				var dfdArray = [];
				dbObj.ColumnSelectors.forEach(function(cs) {
					var dfd = $.Deferred();
					dfdArray.push(dfd.promise());

					insights.applyColumnSelect(cs, dbObj.Visuals, cs.Columns[0].ID, false, true, function() {
						dfd.resolve();
					})
				});

				// Wait for all of the column selectors (asyncronous) to apply before finishing
				$.when.apply(null, dfdArray).done(function() {
					successFunc(dbObj);
				});
			} else {
				errFunc('Invalid Insights object.');
			}
		}, errFunc);
	}

	/* ------ END OF PUBLIC RMVPP FUNCTIONS ------ */

	/* ------ INTERNAL XML OPERATIONS ------ */

	/** Build XML OBIEE analysis from obiee.BIQuery object */
	function buildXML(biQuery, viewsXML) {
		var subjectArea = biQuery.SubjectArea
		var colObjs = biQuery.Criteria
		var filters = biQuery.Filters || [];
		var sort = biQuery.Sort || [];
		var views = viewsXML || [];
		var xml = '<saw:report xmlns:saw="com.siebel.analytics.web/report/v1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlVersion="201201160" xmlns:sawx="com.siebel.analytics.web/expression/v1.1">';
		xml += '<saw:criteria xsi:type="saw:simpleCriteria" subjectArea="&quot;' + subjectArea + '&quot;">';

		// Build column tags
		if (colObjs.length > 0) {
			xml += '<saw:columns>';
			for (var i=0; i < colObjs.length; i++) {
				xml += '<saw:column xsi:type="saw:regularColumn" columnID="c' + i + '">';
				xml += '<saw:columnFormula><sawx:expr xsi:type="sawx:sqlExpression">';
				xml += colObjs[i].Code;
				xml += '</sawx:expr></saw:columnFormula></saw:column>';
			}
			xml += '</saw:columns>';
			xml += buildFilterXML(filters);
			xml += buildSortXML(sort, colObjs);
			xml += '</saw:criteria>';

			if (views.length > 0) {
				xml += '<saw:views>';
				for (var i=0; i < views.length; i++) {
					xml += views[i];
				}
				xml +='</saw:views>';
			}

			xml += '</saw:report>';
			return xml;
		} else
			return false;
	}

	/** Builds sort XML from an array of obiee.BISort objects */
	function buildSortXML(sort, criteria) {
		var xml = "";

		if (sort.length > 0) {
			xml += '<saw:columnOrder>';

			for (var i=0; i < sort.length; i++) {
				dir = sort[i].Direction == 'desc' ? 'descending' : 'ascending';

				// Get column by name (string) or criteria position (number)
				var colRef;
				if (isNaN(sort[i].Column)) {
					for (var j=0; j < criteria.length; j++) {
						if (criteria[j].Name == sort[i].Column)
							colRef = 'c' + j;
					}
				} else
					colRef = 'c' + sort[i].Column;
				xml += '<saw:columnOrderRef columnID="' + colRef + '" direction="' + dir + '"/>'; // Sort by column tag
			}

			xml += '</saw:columnOrder>';
		}
		return xml;
	}

	/** Builds filter XML from an array of obiee.BIFilter and obiee.BIFilterGroup objects
		If only obiee.BIFilter objects present, AND logic is assumed */
	function buildFilterXML(filters) {
		var xml = ""

		if (filters.length > 0) { // Build filter tags
			xml += '<saw:filter>';

			// Convert filter array to an AND filter group
			if (filters.length > 1)
				filters = [new obiee.BIFilterGroup(filters, 'and')];

			for (var i=0; i < filters.length; i++) {
				if (filters[i].Type == 'Filter')
					xml += buildSingleFilterXML(filters[i]);
				else
					xml += buildFilterGroupXML(filters[i]);
			}
			xml += '</saw:filter>';
		}

		return xml;
	}

	/** Build XML for a single filter */
	function buildSingleFilterXML(filter) {
		var xml = "";
		if (filter.FilterType == 'list') {
			xml += '<sawx:expr xsi:type="sawx:list" op="' + filter.Operator + '">';
			xml += '<sawx:expr xsi:type="sawx:sqlExpression">' + filter.Code + '</sawx:expr>';

			var value;
			if (typeof(filter.Value) == 'string')
				value = filter.Value.split(';');
			else
				value = filter.Value;

			for (var j=0; j < value.length; j++) {
				xml += '<sawx:expr xsi:type="xsd:' + filter.DataType + '">' + value[j] + '</sawx:expr>';
			}
			xml += '</sawx:expr>';
		} else {
			xml += '<sawx:expr xsi:type="sawx:' + filter.FilterType + '" op="' + filter.Operator + '">';
			xml += '<sawx:expr xsi:type="sawx:sqlExpression">' + filter.Code + '</sawx:expr>';
			xml += '<sawx:expr xsi:type="xsd:' + filter.DataType + '">' + filter.Value + '</sawx:expr>';
			xml += '</sawx:expr>';
		}
		return xml;
	}

	/** Buid XML for a filter group */
	function buildFilterGroupXML(filterGroup) {
		var xml = "";

		xml += '<sawx:expr xsi:type="sawx:logical" op="' + filterGroup.Operator + '">';

		var filters = filterGroup.Filters;

		for (var j=0; j < filters.length; j++) {
			if (filters[j].Type == 'Filter')
				xml += buildSingleFilterXML(filters[j])
			else
				xml += buildFilterGroupXML(filters[j])
		}

		xml += '</sawx:expr>';
		return xml;
	}

	/** Build Static Text (HTML) view XML */
	function buildHTMLViewXML(html) {
		var xml = '<saw:view xsi:type="saw:htmlview" name="rmvppView">';
		xml += '<saw:staticText><saw:caption fmt="html"><saw:text>';
		html = html.split('\n');
		for (var i=0; i<html.length; i++) {
			html[i] = html[i].replace(/</g, '&lt;').replace(/>/g, '&gt;');
		}
		html = html.join('\n');
		xml += html;
		xml += '</saw:text></saw:caption></saw:staticText></saw:view>';
		return xml;
	}

	/** Set a compound view with a custom view name. */
	function buildCompoundViewXML(viewName) {
		var compoundView = '<saw:view xsi:type="saw:compoundView" name="compoundView!1">';
		compoundView += '<saw:cvTable><saw:cvRow><saw:cvCell viewName="'+viewName+'"/></saw:cvRow>';
		compoundView += '</saw:cvTable></saw:view>';
		return compoundView;
	}

	/** Execute XML - will respect decimals on older OBIEE versions */
	function executeXML(xml, successFunc, biQuery) {
		biQuery = biQuery || "";
		if (typeof(xml) == 'object') // Convert to string if necessary
			xml = new XMLSerializer().serializeToString(xml);

		// Build SOAP message
		xml = '<![CDATA[' + xml + ']]>';

		var soapMessage = obieeSOAPHeader();
		soapMessage += '<soapenv:Header/><soapenv:Body><'+wsdl+':executeXMLQuery><'+wsdl+':report><'+wsdl+':reportXml>' + xml;
		soapMessage += '</'+wsdl+':reportXml></'+wsdl+':report><'+wsdl+':outputFormat>SawRowsetData</'+wsdl+':outputFormat><'+wsdl+':executionOptions><'+wsdl+':async>FALSE</'+wsdl+':async>';
		soapMessage += '<'+wsdl+':maxRowsPerPage>100000</'+wsdl+':maxRowsPerPage><'+wsdl+':refresh>TRUE</'+wsdl+':refresh><'+wsdl+':presentationInfo>TRUE</'+wsdl+':presentationInfo><'+wsdl+':type>query</'+wsdl+':type>';
		soapMessage += '</'+wsdl+':executionOptions><'+wsdl+':reportParams/><'+wsdl+':sessionID>' + sessionStorage.obieeSessionId + '</'+wsdl+':sessionID>';
		soapMessage += '</'+wsdl+':executeXMLQuery></soapenv:Body></soapenv:Envelope>';

		// Call web service
		wsCall('xmlViewService', soapMessage, function(response) {
			var rowset = response.Body.executeXMLQueryResult.return.rowset;
			rowset = rowset.concat();

			var outputData = $.xml2json(rowset);
			outputData = outputData.Row;

			if (!$.isArray(outputData))
				outputData = [outputData];

			// Map output in accordance with input obiee.BIQuery criteria names
			if (biQuery != "")
				outputData = mapResults(biQuery, outputData);

			if (outputData.length == 2500)
				console.warn('Warning: reached 2500 row limit for XML queries.');
			successFunc(outputData);
		});
	}

	/* ------ END OF INTERNAL XML OPERATIONS ------ */

	/* ------ GENERAL INTERNAL FUNCTIONS ------ */

	/** Get cookie value by name */
	function getCookie(name) {
	  var value = "; " + document.cookie;
	  var parts = value.split("; " + name + "=");
	  if (parts.length == 2) return parts.pop().split(";").shift();
	}

	/** Create a cookie with a name value, time length and export path. */
	function createCookie(name,value,days,path) {
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}
		else var expires = "";
		document.cookie = name+"="+value+expires+"; path="+path;
	}

	/** Delete a cookie. */
	function eraseCookie(name, path) {
		createCookie(name,"",-1,path);
	}

	/** Rename a property of an object */
	function renameProperty(obj, oldName, newName) {
		 // Do nothing if the names are the same
		 if (oldName == newName) {
			 return obj;
		 }
		// Check for the old property name to avoid a ReferenceError in strict mode.
		if (obj.hasOwnProperty(oldName)) {
			obj[newName] = obj[oldName];
			delete obj[oldName];
		}
		return obj;
	};

	/** Parse information for a column recieved from the BI Server. */
	function parseColumnInfo(results) {
		var columnInfo = {
			isMeasure: false,
			hasSortKey: false,
			hasIDField: false,
			isTimeDim: false,
			partOfHierarchy: false,
			aggRule: 'none',
			description: '',
			dataType: 'varchar'
		};

		if (results.hasOwnProperty('Column1')) {
			switch(results.Column1) {
				case '1': columnInfo.dataType = 'varchar'; break;
				case '2': columnInfo.dataType = 'numeric'; break;
				case '4': columnInfo.dataType = 'integer'; break;
				case '7': columnInfo.dataType = 'float'; break;
				case '8': columnInfo.dataType = 'double'; break;
				case '91': columnInfo.dataType = 'date'; break;
			}
		}

		// Check if measure (column 4)
		if (results.hasOwnProperty('Column4')) {
			if (results.Column4 == '2')
				columnInfo.isMeasure = true;
		}

		// Check for special properties (column 7)
		if (results.hasOwnProperty('Column7')) {
			if (results.Column7.indexOf('sortkeypresent') > -1)
				columnInfo.hasSortKey = results.Column8;

			if (results.Column7.indexOf('codedField') > -1)
				columnInfo.hasIDField = true;

			if (results.Column7.indexOf("istimedimension") > -1)
				columnInfo.isTimeDim = true;
		}

		if (results.hasOwnProperty('Column5'))
			columnInfo.aggRule = results.Column5.toLowerCase();

		if (results.hasOwnProperty('Column13'))
			columnInfo.description = results.Column13;

		return columnInfo;
	}

	/** Check if an OBIEE response set is an error. */
	function isError(results) {
		return results.hasOwnProperty('faultcode') && results.hasOwnProperty('faultstring');
	}

	/**
		* Gets the relevant error objects from a BI Server web service response. Assumes there is an error in the input at `response.detail.Error.Error.Error`.
		* Uses RegEx to clean up response, removing some unnecessary information like HY000 codes.
		* @param {Object} response
		* @returns {Object} Object describing the error. Has two properties: `basic`, a short description and `sql`, the logical SQL executed.
	*/
	obiee.getErrorDetail = function(response) {
		if (response.detail) {
			var errors = response.detail.Error.Error.Error;
			var tidyError = '';
			// Example: State: HY000. Code: 10058. [NQODBC] [SQL_STATE: HY000] [nQSError: 10058] A general error has occurred. [nQSError: 43113] Message returned from OBIS.

			var coreMessage = true;
			errors.forEach(function(e) {
				msg = e.Message.replace(/.*]/g,'').replace(/\(HY000\)/,'').replace(/SQL Issued: .*/,'')
				var re = RegExp('SQL Issued:');
				if (re.exec(e.Message))
					coreMessage = false;

				if (coreMessage)
					tidyError += msg;
			});

			var error = {
				basic: tidyError,
				sql: errors[1].Message
			}
		} else
			var error = { basic: response }
		return error;
	}

	/* ------ GENERAL INTERNAL FUNCTIONS ------ */

	/* ------ BI OBJECT FUNCTIONS ------ */

	/**
		* Search for filter using a `BIFilter` object and replace it.
		* @param {BIFilter[]} filters Filter array to iterate over. Can include `BIFilterGroup` objects as function will recurse if necessary.
		* @param {BIFilter} filter New filter to replace if a match is found in the array/hierarchy.
		* @param {boolean} changed Indicates whether this filter array has been modified.
		* @returns {boolean} True if the filter hierarchy has been modified by the function.
	*/
	obiee.replaceFilter = function(filters, newFilter, changed) {
		var code = newFilter.Code, changed = changed || false;
		for (var j=0; j < filters.length; j++) {
			if (filters[j].Type == 'Filter') {
				if (filters[j].Code == code) {
					if (!filters[j].Protected) {
						filters[j] = newFilter;
						changed = true;
					} else
						changed = 'protected';
				}
			} else {
				changed = obiee.replaceFilter(filters[j].Filters, newFilter, changed); // Recursively loop through filter groups
			}
		}
		return changed;
	}

	/**
	* Identifies if a visualisation is affected by any of the dashboard prompt filters on a page.
	* Will match if *any* filter that is a member of prompts.Filters has a matching subject area to the visualisation.
	* @param {BIVisual} vis Visualisation to check if prompted.
	* @param {BIPrompt} prompts Prompt object containing all dashboard prompt filters.
	* @returns {boolean} Indicates whether or not the visaulisation is prompted.
	*/
	obiee.isPrompted = function(vis, prompts) {
		var refresh = false;
		if (!$.isEmptyObject(prompts)) {
			prompts.Filters.forEach(function(f) {
				if (f.SubjectArea == vis.Query.SubjectArea)
					refresh = true;
			});
		}
		return refresh;
	};

	/**
		* Similar to `obiee.replaceFilter` but matches filters using the `ID` property instead of the code.
		* @param {BIFilter[]} filters Filter array to iterate over. Can include `BIFilterGroup` objects as function will recurse if necessary.
		* @param {string} filterID ID of the filter to replace if a match is found in the array/hierarchy.
		* @param {string} filterOp New operator to assign if a match is found.
		* @param {string} filterValue New value to assign if a match is found.
		* @param {boolean} changed Indicates whether this filter array has been modified.
		* @returns {boolean} True if the filter hierarchy has been modified by the function.
	*/
	obiee.replaceFilterByID = function(filters, filterID, filterOp, filterValue, changed) {
		changed = changed || false;
		for (var j=0; j < filters.length; j++) {
			if (filters[j].Type == 'Filter') {
				if (filters[j].ColumnID == filterID) {
					if (!filters[j].Protected) {
						filters[j].Value = filterValue;
						filters[j].Global = false;
						if (filterOp)
							filters[j].Operator = filterOp;
						changed = true;
					} else
						changed = 'protected';
				}
			} else
				changed = obiee.replaceFilterByID(filters[j].Filters, filterID, filterOp, filterValue, changed); // Recursively loop through filter groups
		}
		return changed;
	}

	/** Check if any filter has a value */
	function checkFiltersHaveValue(filters, hasValue) {
		hasValue = hasValue || false;
		filters.forEach(function(f, i) {
			if (f.Type == 'Filter') {
				var bool = true;
				if (f.DataType != 'date' && f.DataType != 'decimal') {
					if ($.inArray(f.Operator, ['isNull', 'isNotNull']) > -1) {
						hasValue = true;
					} else if (f.Value.length > 0) {
						if ($.isArray(f.Value)) {
							f.Value.forEach(function(v) {
								if (v)
									hasValue = true;
							});
						} else {
							if (f.Value)
								hasValue = true;
						}
					}
				} else {
					if (f.DataType == 'decimal') {

						if (!isNaN(f.Value)) {
							f.Value = +f.Value;
							hasValue = true;
						}
					} else {
						if (f.Value) {
							hasValue = true;
						}
					}
				}
			} else
				hasValue = checkFiltersHaveValue(f.Filters, hasValue);
		});
		return hasValue;
	}

	/**
		* Remove explicit global filters from visualisations.
		* This prevents a prompt from being created and ran, and then persisted after removal in design mode.
		* @param {BIFilter[]} filters Filter array from a prompt object
		* @param {boolean} changed Indicates whether this filter array has been modified.
		* @returns {boolean} True if the filter hierarchy has been modified by the function.
	*/
	obiee.removePromptedFilters = function(filters, changed) {
		var changed = changed || false;
		var removeIndices = [];

		for (var i=0; i < filters.length; i++) {
			if (filters[i].Type == 'Filter') {
				if (filters[i].Global && !filters[i].Protected) {
					removeIndices.push(i);
					changed = true;
				}
			} else {
				changed = obiee.removePromptedFilters(filters[i].Filters, changed); // Recursively loop through filter groups
				if (filters[i].Filters.length == 0) { // Remove filter group if it has no children
					removeIndices.push(i);
					changed = true;
				}
			}
		}

		for (var i = removeIndices.length -1; i >= 0; i--)
			filters.splice(removeIndices[i],1);
		return changed;
	}

	/** Get column info for a column map */
	function getColumnInfo(columns) {
		var mainDFD = new $.Deferred(), promises = [];

		// Fetch column information
		function getInfo(column) {
			var dfd = new $.Deferred();
			column.verify(function(details) {
				column.SortKey = details.hasSortKey;
				dfd.resolve();
			});
			return dfd.promise();
		}

		columns.forEach(function(col) {
			if (col.Code) // Fetch column details if not already existing
				promises.push($.when(getInfo(col)));
		});

		// Wait for all columns to get information
		$.when.apply(null, promises).done(function() {
			columns.forEach(function(col) {
				if (col.SortKey) {
					var sortCol = new obiee.BIColumn('SORTKEY(' + col.Code + ')', col.Name + ' (Sort)', 'integer');
					sortCol.Table = 'RM-Sort';
					sortCol.SubjectArea = col.SubjectArea;
					columns.push(sortCol);
				}
			});
			mainDFD.resolve();
		});

		return mainDFD.promise();
	}

	/** Add sort columns to the criteria */
	function addSortColumns(criteria) {
		criteria.forEach(function(col) {
			if (col.SortKey) {
				var sortCol = new obiee.BIColumn('SORTKEY(' + col.Code + ')', col.Name + ' (Sort)', 'integer');
				sortCol.Table = 'RM-Sort';
				sortCol.SubjectArea = col.SubjectArea;
				if ($.inArray(sortCol.Code, criteria.map(function(c) { return c.Code; })) == -1)
					criteria.push(sortCol);
			}
		});
	}

	/**
		* Show visualisation unless it is included in a visual selector.
		* @param {BIVisualSelector[]} visSelectors Array of visualisation selectors
		* @param {BIVisual} vis Visualisation to check
		* @returns {boolean} True if the visualisation can be shown, false if hidden
	*/
	obiee.showOrHideVis = function(visSelectors, vis) {
		var show = true;
		visSelectors.forEach(function(vs) {
			var enabled = vs.Visuals.filter(function(f) {
				return f.enabled;
			}).map(function(f) { return f.name; });

			if ($.inArray(vis.Name, enabled) > -1 && vis.Name != vs.Selected) {
				show = false;
			}
		});
		return show;
	}

	/**
		* Flattens column map object (containing a mixture of properties and arrays) to an object of just properties.
		* Multiple columns use the property suffixed with a numeric index. Excludes null columns (columns without a Code defined).
		* @param {Object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @param {boolean} dimOnly Indicates whether or not to exclude measure attributes.
		* @returns {Object} Object where properties are column IDs (specfied by the plugin)
	*/
	obiee.simplifyColumnMap = function(columnMap, dimOnly) {
		var simple = {}

		function colCheck(col) {
			var out = false;
			if (dimOnly) {
				out = col.Measure == 'none' && col.Code;
			} else {
				out = col.Code;
			}
			return out;
		}

		for (col in columnMap) {
			if ($.isArray(columnMap[col])) {
				columnMap[col].forEach(function(c, i) {
					var check = colCheck(c)
					if (check) {
						simple[col + i] = c;
					}
				});
			} else {
				var check = colCheck(columnMap[col])
				if (check) {
					simple[col] = columnMap[col];
				}
			}
		}
		return simple;
	}

	/**
		Applies a function to all columns in column map.
		* @param {object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @param {function} func The function to apply to each of the `BIColumn` objects.
	*/
	obiee.applyToColumnMap = function(columnMap, func) {
		for (col in columnMap) {
			if ($.isArray(columnMap[col])) {
				columnMap[col].forEach(function(c) {
					func(c, obiee.getColIDFromName(c.Name, columnMap));
				});
			} else {
				func(columnMap[col], col);
			}
		}
		return columnMap;
	}

	/**
		Applies a funciton to all column maps in a column set. This performs no special action unless
		the `multipleDatasets` property of the plugin is set to `true`. Can be used to build generic objects of
		the same structure too.
		* @param {object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @param {string} plugin ID of the plugin to which the column map applies. Used to get the `multipleDatasets` property.
		* @param {function} func The function to apply to each of the column **sets**.
		* If `multipleDatasets` is `false`, the column set is just a regular column map Object.
		* If `multipleDatasets` is `true`, the column set is an object where each key is a different query containing
		* individual column maps.
	*/
	obiee.applyToColumnSets = function(columnSet, plugin, func) {
		if (rmvpp.Plugins[plugin].multipleDatasets) {
			for (dataset in rmvpp.Plugins[plugin].columnMappingParameters) {
				columnSet[dataset] = func(columnSet[dataset], dataset);
			}
		} else {
			columnSet = func(columnSet);
		}
		return columnSet;
	}

	/**
		Removes a column from a column map - either removing from an array for a multiple, or setting to a null `BIColumn` for a single.
		* @param {object}  columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* @param {BIColumn} findCol Column to remove from the map.
	*/
	obiee.removeFromColumnMap = function(columnMap, findCol) {
		for (col in columnMap) {
			if ($.isArray(columnMap[col])) {
				$.removeFromArray(findCol, columnMap[col]);
			} else {
				if (columnMap[col] == findCol) {
					columnMap[col] = new obiee.BIColumn();
				}
			}
		}
		return columnMap;
	}

	/** Gives an appropriate null value depending on the type of column, i.e. 0 for measures, '' otherwise. */
	function nullVal(col) {
		return col.Measure == 'none' ? '' : 0;
	}

	/**
		Generates a null datum based on a column map. This will have the same structure as the
		real dataset but 0s for measures and null values for attributes
		* @param {Object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @returns {Object} Single object matching the data structure produced by the column map but with null values.
	*/
	obiee.nullDatum = function(columnMap) {
		var newDatum = {};
		for (col in columnMap) {
			if ($.isArray(columnMap[col])) {
				newDatum[col] = [];
				columnMap[col].forEach(function(c, i) {
					newDatum[c.Name] = c.Measure == 'none' ? '' : '0'; // 0 should be a string here to match dataset
					newDatum[col][i] = { name: c.Name, value : nullVal(c) };
				});
			} else {
				newDatum[col] = nullVal(columnMap[col]);
			}
		}
		return newDatum;
	}

	/**
		* Get true column name from a simplified column map ID.
		* @param {string} id Simplified column map ID to retrieve.
		* @param {Object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @param {string} dataset Dataset ID that can be passed to accomodate for multiple dataset column maps.
		* @returns {string} Column name as specified by the `Name` attribute of the `BIColumn` object.
		* @see simplifyColumnMap
		* @see getColIDFromName
	*/
	obiee.getColNameFromID = function(id, columnMap, dataset) {
		var cm = dataset ? columnMap[dataset] : columnMap;
		var cmByID = obiee.simplifyColumnMap(cm);

		if (cmByID[id]) {
			return cmByID[id].Name;
		} else {
			return '';
		}
	}

	/**
		* Gets a column ID from a source visualisation based on a trigger ID.
		* This caters for multiple datasets where the dataset ID is provided by the action trigger.
	*/
	obiee.getColNameFromVisAndTrigger = function(id, vis, trigger) {
		var sourcePlugin = rmvpp.Plugins[vis.Plugin];
		if (sourcePlugin.multipleDatasets) {
			var dataset = sourcePlugin.actions.filter(function(a) { return a.trigger == trigger; })[0].dataset;
			return obiee.getColNameFromID(id, vis.ColumnMap[dataset]);
		} else {
			return obiee.getColNameFromID(id, vis.ColumnMap);
		}
	}

	/**
		* Gets the dataset ID of a multiple dataset query structure from and input visualisation and a subject area.
	*/
	obiee.getDatasetsFromSubjectArea = function(plugin, query, sa) {
		var plugin = rmvpp.Plugins[plugin];
		if (plugin.multipleDatasets) {
			out = [];
			for (dataset in query) {
				if (query[dataset].SubjectArea == sa) {
					out.push(dataset);
				}
			}
			return out;
		} else {
			return null;
		}
	}

	/**
		* Returns the property code from a column ID. Strips the index away if it is defined as a multiple.
		* @returns {string}
	*/
	obiee.getPropFromID = function(id) {
		var property = id, re = new RegExp('(.*?)\\d').exec(id);
		if (re)
			property = re[1];
		return property;
	};

	/**
		* Get simplified column map ID from a true column name.
		* @param {string} name Column name as specified by the `Name` attribute of the `BIColumn` object.
		* @param {Object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* The precise structure is determined by the plugin itself.
		* @returns {string} Column ID as represented by the simplified column map.
		* @see simplifyColumnMap
		* @see getColIDFromID
	*/
	obiee.getColIDFromName = function(name, columnMap) {
		var sm = obiee.simplifyColumnMap(columnMap), output;
		for (prop in sm) {
			if (sm[prop].Name == name)
				output = prop;
		}
		return output;
	}

	/**
		* Translation function for filter operators.
		* @param {string} op Textual operator ID, e.g. equal, less, notEqual, greater, lessOrEqual, heatmap etc.
		* @returns {string} Readable operator name, e.g. ==, <, !=, >, <=, Heatmap etc.
	*/
	obiee.operatorToText = function(op) {
		var output;
		switch(op) {
			case 'equal':
				output = '==';
				break;
			case 'less':
				output = '<';
				break;
			case 'notEqual':
				output = '!='
				break;
			case 'greater':
				output = '>';
				break;
			case 'lessOrEqual':
				output = '<=';
				break;
			case 'greaterOrEqual':
				output = '>='
				break;
			case 'heatmap':
				output = 'Heatmap'
				break;
		}
		return output;
	}

	/** Get index from column shorthand */
	function columnIdx(id) {
		var index = -1, re = new RegExp('(\\d*)$').exec(id);
		if (re)
			index = +re[1];
		return index;
	}

	/** Get value from row based on the shorthand index */
	function getValueFromRow(row, id) {
		var re = new RegExp('(.*?)\\d'), col = id, value;
		if (re.exec(id)) {
			col = re.exec(id)[1];
			value = row[col][columnIdx(id)].value;
		} else
			value = row[col];

		return value;
	}

	/** Get columns available for an interaction */
	function getDefaultColumns(interact) {
		var sourcePlugin = rmvpp.Plugins[interact.SourceVis.Plugin];
		var cm = interact.SourceVis.ColumnMap, passCols = {}, trigger = interact.Trigger;
		var action = sourcePlugin.actions.filter(function(a) { return a.trigger == trigger; });

		if (sourcePlugin.multipleDatasets && action.length > 0) {
			cm = interact.SourceVis.ColumnMap[action[0].dataset];
		}

		if (action.length > 0) {
			restrict = action[0].output;
		} else {
			restrict = [];
		}

		for (key in cm) {
			if (restrict.length == 0 || ($.inArray(key, restrict) > -1)) {
				if ($.isArray(cm[key])) {
					cm[key].forEach(function(m, i) {
						if (m.Measure == 'none' && m.Code) {
							passCols[key + i] = true;
						}
					});
				} else {
					if (cm[key].Measure == 'none' && cm[key].Code) {
						passCols[key] = true;
					}
				}
			}
		}
		return passCols;
	}

	/** Adds missing attributes to the Fabric JSON object to prevent loading errors */
	function cleanCanvasJSON(canvasJSON) {
		canvasJSON.objects.forEach(function(obj) {
			if (!obj.top)
				obj.top = 0;
			if (!obj.left)
				obj.left = 0;
			if (!obj.scaleX)
				obj.scaleX = 1;
			if (!obj.scaleY)
				obj.scaleY = 1;
		});
		return canvasJSON;
	}

	/** Checks LSQL column code for presentation variables and parses them */
	function parsePresVar(colCode){
		var findPresVars = new RegExp("@\{.*?\}{.*?\}{.*?\}|@\{.*?\}{.*?\}|\@\{.*?\}", 'g');
		var presVars = colCode.match(findPresVars)

		// Returns either the variable value or the default
		function varOrDefault(varName, dVal, opt) {
			dVal = dVal || "''"; // Set defaults
			opt = opt || "outer";

			var presVar = obiee.getVariable(varName, 'Presentation'), out;
			if (presVar.Value) { // Parse presentation value according to option
				var value = presVar.Value;

				if (opt == 'outer') {
					value = value.join(',');
					value = "'" + value + "'";
				} else if (opt == 'inner') {
					value = value.join("','");
					value = "'" + value + "'";
				}
				out = value;
			} else { // Default value
				if (opt == 'outer' || opt == 'inner')
					dVal = "'" + dVal + "'";
				out = dVal;
			}
			return out;
		}

		if (presVars) {
			presVars.forEach(function(pvar) {
				pvar = $.trim(pvar);
				var numOpt = pvar.match(/\{/g);
				if (numOpt.length == 1) { // Only presentation variable defined
					var name = /@\{(.*?)\}/.exec(pvar)[1];
					colCode = colCode.replace(pvar, varOrDefault(name));
				} else if (numOpt.length == 2) { // Pres var and default defined
					var split = /@\{(.*?)\}{(.*?)\}/.exec(pvar);
					var name = split[1], dVal = split[2];
					colCode = colCode.replace(pvar, varOrDefault(name, dVal));
				} else if (numOpt.length == 3) {
					var split = /@\{(.*?)\}{(.*?)\}{(.*?)\}/.exec(pvar);
					var name = split[1], dVal = split[2], opt = split[3];
					colCode = colCode.replace(pvar, varOrDefault(name, dVal, opt));
				}
			});
		}

		return colCode
	}

	/** Fetches and cleans variables, then stores them in `obiee.BIVariables` */
	obiee.fetchVariables = function() {
		obiee.BIVariables = {
			Session : [],
			Repository : [],
			Presentation : []
		};  // Refresh object

		var c1 = new obiee.BIColumn('', 'Name');
		var c2 = new obiee.BIColumn('', 'Type');
		var c3 = new obiee.BIColumn('', 'Size');
		var c4 = new obiee.BIColumn('', 'Value');
		var query = new obiee.BIQuery([c1,c2,c3,c4]);

		obiee.executeLSQL("Call NQSGetSessionValues('%')", function(results) {
			results.forEach(function(r) {
				if (r.Name.indexOf('NQ_SESSION.') == 0) { // Session variable
					var variable = new obiee.BIVariable(r.Name.replace('NQ_SESSION.',''), 'Session', r.Value.split(';'));
					obiee.BIVariables['Session'].push(variable);
				} else { // Repository variable
					if (r.Type == 'VARCHAR')
						r.Value = r.Value.substr(1,r.Value.length-2);

					var variable = new obiee.BIVariable(r.Name, 'Repository', r.Value);
					obiee.BIVariables['Repository'].push(variable);
				}
			});
		}, query, function(err) {
			if (err.faultstring.indexOf('Invalid session ID') > -1)
				obiee.logoff();
		});
	}

	/**
		* Updates or adds a presentation variable to `obiee.BIVariables`.
		* @param {string} name Name for the variable.
		* @param {string} value Value the presentation variable should take. This needs to parse verbatim as logical SQL,
		* for example strings should be encased in single quotes.
	*/
	obiee.updatePresVar = function(name, value) {
		var exists = obiee.getVariable(name, 'Presentation');
		if (exists) {
			exists.Value = value;
		} else {
			var newVar = new obiee.BIVariable(name, 'Presentation', value);
			obiee.BIVariables['Presentation'].push(newVar);
		}
	}

	/**
		* Get variable value by name and type.
		* @param {string} name Variable name, should be in CAPS for session/repository variables.
		* @param {string} type Variable type, should be one of 'Repository', 'Session'.
		* @returns {string|Array} Array of values for the variable. Repository variables will only have one element maximum.
	*/
	obiee.getVariable = function(name, type) {
		var variable = obiee.BIVariables[type].filter(function(v) {
			return v.Name == name && type == v.VarType;
		});

		if (variable.length > 0) {
			return variable[0];
		} else
			return false;
	}

	/**
		* Activate triggers and functions for interactions.
		* @param {BIInteraction|BIDrilldown} interaction Interaction or drilldown to activate.
		* @param {scope} Angular scope to pass through for triggering dashboard wide events.
	*/
	obiee.createInteraction = function (interaction, scope) {
		if (interaction.Action == 'drill')
			interaction.Handler = insights.generateDrillHandler(interaction, scope);
		else
			interaction.Handler = insights.generateHandler(interaction.Action, interaction.SourceVis, interaction.TargetVis, interaction.Columns, scope);

		var visElement = interaction.SourceVis.Container;
		interactionData = {}; // Data to be stored in the event handler itself
		interactionData.Action = interaction.Action;
		interactionData.SourceNum = interaction.SourceNum;
		interactionData.Columns = interaction.Columns;

		if (interaction.Action == 'drill')
			interactionData.DrillPath = interaction.DrillPath;
		else
			interactionData.TargetNum = interaction.TargetNum;

		$(visElement).on(interaction.Trigger, '', interactionData, interaction.Handler); // Use the 'data' object in the jQuery 'on' function to store the mapping
	}

	/**
		* Remove an interaction from a visualisation container.
		* @param {BIInteraction|BIDrilldown} action Interaction or drilldown to deactivate.
	*/
	obiee.removeInteraction = function (action) {
		$(action.SourceVis.Container).off(action.Trigger, action.Handler);
	}

	/* ------ END OF BI OBJECT FUNCTIONS ------ */

	/* ------ BI CLASS OBJECTS ------ */

	/**
		* @class
		* Presentation column object.
		* @param {string} code OBIEE column code, typically of the form "Table"."Column" but can also be a formula.
		* @param {string} name Column name.
		* @param {string} [dataType=varchar] OBIEE defined data type. Can be one of `varchar`, `integer`, `double`, `date`..
		* @param {string} [table=Unspecified] Table name.
		* @param {string} [aggRule=none] Aggregation rule, e.g.`none`, `sum`, `avg`.
		* @param {string} [subjectArea] Subject area this column belongs to.
		* @param {string} [dataFormat=this.getDefaultFormat] Specify a D3 data formatting string.
		* @param {object} [config={}] Column specific configuration object.
	*/
	obiee.BIColumn = function(code, name, dataType, table, aggRule, subjectArea, dataFormat, config, locale) {
		/** Column code. */
		this.Code = code;

		/** Column name. */
		this.Name = name;

		/** Column description. */
		this.Description;

		/** Data type. Can be one of `varchar`, `integer`, `double`, `date`, `timestamp`. */
		this.DataType = dataType || 'varchar';

		/** Presentation table name. */
		this.Table = table || "Unspecified";

		/** Aggregation rule, e.g.`none`, `sum`, `avg`. */
		this.Measure = aggRule || "none";

		/** Column ID, defined as Table.Name. */
		this.ID = this.Table + '.' + name;

		/**  Subject area this column belongs to. */
		this.SubjectArea = subjectArea || '';

		/** Holds the column ID of a sort column if one has been defined in OBIEE. */
		this.SortKey = false;

		/**
			Generates default D3 format string based on the OBIEE datatype via a simple switch. E.g. `double` produces a format of `.3s`.
			@returns {String} D3 format string
		*/
		this.getDefaultFormat = function() {
			var formatString;
			switch(this.DataType) {
				case 'double':
					formatString = InsightsConfig.DataFormats.double;
					break;
				case 'numeric':
					formatString = InsightsConfig.DataFormats.numeric;
					break;
				case 'integer':
					formatString = InsightsConfig.DataFormats.integer;
					break;
				case 'date':
					formatString = InsightsConfig.DataFormats.date;
					break;
				case 'timestamp':
					formatString = InsightsConfig.DataFormats.timestamp;
					break;
				case 'varchar':
					formatString = InsightsConfig.DataFormats.varchar;
					break;
				default:
					formatString = '%s';
					break;
			}
			return formatString;
		}

		/** Locality of the column for formatting purposes. Defaults to `rmvpp.defaults.locale`. */
		this.Locale = locale || InsightsConfig.Locale;

		/** D3 data format string. Defaults using `getDefaultFormat`. */
		this.DataFormat = dataFormat || this.getDefaultFormat();

		/**
			Formats a value using D3
			@param value Value to be formatted
			@param {String} [formatString=this.DataFormat] D3 format string to format with
			@returns Formatted value.
		*/
		this.format = function(value, formatString) {
			formatString = formatString || this.DataFormat;
			var formatted = value, locale = this.Locale;

			function customAbbrev(formatString, value) {
				var s = rmvpp.locales[locale].numberFormat(formatString)(value);
			    switch (s[s.length - 1]) {
					case "k":
						if (InsightsConfig.SIPrefixes.hasOwnProperty('k'))
							s = s.slice(0, -1) + InsightsConfig.SIPrefixes.k;
						break;
					case "M":
						if (InsightsConfig.SIPrefixes.hasOwnProperty('M'))
							s = s.slice(0, -1) + InsightsConfig.SIPrefixes.M;
						break;
			    	case "G":
						if (InsightsConfig.SIPrefixes.hasOwnProperty('G'))
							s = s.slice(0, -1) + InsightsConfig.SIPrefixes.G;
						break;
			    }
			    return s;
			}

			function numFormat(formatString, value) {
			    if (value) {
					if (formatString.indexOf('s') > -1) {
						return customAbbrev(formatString, value);
					} else
			        	return rmvpp.locales[locale].numberFormat(formatString)(value);
			    } else {
			        return '';
			    }
			}

			switch(this.DataType) {
			    case 'double': formatted = numFormat(formatString, value); break;
			    case 'integer': formatted = numFormat(formatString, value); break;
			    case 'numeric': formatted = numFormat(formatString, value); break;
				case 'date':
					var dateValue;
					if (value instanceof Date)
						dateValue = value;
					else
						dateValue = rmvpp.locales[this.Locale].timeFormat("%Y-%m-%d").parse(value); // Returns a Date
					formatted = rmvpp.locales[this.Locale].timeFormat(formatString)(dateValue);
					break;
				case 'timestamp':
					var dateValue;
					if (value instanceof Date) {
						dateValue = value;
					} else {
						dateValue = rmvpp.locales[this.Locale].timeFormat("%Y-%m-%dT%H:%M:%S").parse(value); // Returns a Date
					}
					formatted = rmvpp.locales[this.Locale].timeFormat(formatString)(dateValue);
					break;
				case 'varchar':
					if (formatString != '%s' && formatString)
						formatted = formatString.replace(/%s/g, value);
					break;
				default:
					break;
			}
			return formatted;
		}

		var column = this;
		/**
			Verifies this column using a call to OBIEE. Will identify sort keys and aggregation rules for the column and also determines if the column formula is valid.
			@param {function} successFunc Callback function to execute on success
			@param {function} errorFunc Callback function to execute on failure
			@returns {Object} Object describing column, including description, sort column, aggregation rule and whether or not is part of a chronological dimension.
		*/
		this.verify = function(successFunc, errorFunc) {
			var lsql = "call NQSGetQueryColumnInfo('SELECT ";
			lsql += parsePresVar(this.Code).replace(/'/g, "''");
			lsql += " FROM \"" + this.SubjectArea + "\"')";

			obiee.executeLSQL(lsql, function(results) {
				if (isError(results)) {
					console.log(obiee.getErrorDetail(results));
					throw 'Error';
				} else {
					var columnInfo = parseColumnInfo(results[0]);
					column.Verified = true;
					column.Measure = columnInfo.aggRule;
					column.SortKey = columnInfo.hasSortKey;
					if (column.DataType != 'timestamp' && column.DataType != columnInfo.dataType) {  // Timestamp not returned as a data type from this function
						column.DataType = columnInfo.dataType;
						column.DataFormat = column.getDefaultFormat();
					}
					successFunc(columnInfo);
				}
			}, false, errorFunc);
		}

		/** Contains all column and plugin specific configuration information. Parameters specified by `columnMappingParameters` on plugins. */
		this.Config = config || {};

		/** Indicates whether this object has been verified. */
		this.Verified = false;

		/** Hardcoded type identifier for the object: `Column`. */
		this.Type = 'Column';
	}

	/**
		* @class
		* Conditional formatting object.
		* @param {String} sourceID Simplified column map ID for the column on which the formatting rule is based.
		* @param {String} targetID Simplified column map ID for the column on which the formatting style should be applied.
		* @param {string|number} val Value the rule has to match.
		* @param {string} op Operator ID for the formatting rule. Can be one of 'equal', 'notEqual', 'greater', 'greaterOrEqual', 'less', 'lessOrEqual' or 'heatmap'.
		* @param {string} colour Hex colour to apply if the formatting rule is matched.
		* @param {Object} columnMap Column Map objects have properties containing `BIColumn` objects or arrays of them.
		* @param {string} dataset Dataset ID for use with plugins that have multiple datasets allowed.
		* The precise structure is determined by the plugin itself.
	*/
	obiee.BIConditionalFormat = function(sourceID, targetID, val, op, style, columnMap, dataset) {
		/** Simplified ID for the column on which to base the rule. */
		this.SourceID = sourceID || '';

		// Dataset ID for use with plugins that have multiple datasets.
		this.Dataset = dataset || null;

		/** Name of the column on which to base the rule. */
		this.SourceName = obiee.getColNameFromID(this.SourceID, columnMap, this.Dataset) || '';

		var property = this.SourceID, index = 'none', re = new RegExp('(.*?)\\d');
		if (re.exec(this.SourceID)) {
			property = re.exec(this.SourceID)[1];
			index = +RegExp('(\\d*)$').exec(this.SourceID)[1];
		}

		/** Returns the property code of the source column. Strips the index away if it is defined as a multiple. */
		this.sourceProperty = function() {
			var property = this.SourceID, re = new RegExp('(.*?)\\d').exec(this.SourceID);
			if (re)
				property = re[1];
			return property;
		};

		/** Returns the index of the source column if it is defined as a multiple. */
		this.sourceIndex = function() {
			return columnIdx(this.SourceID);
		};

		/** Returns the property code of the target column. Strips the index away if it is defined as a multiple. */
		this.targetProperty = function() {
			var property = this.TargetID, re = new RegExp('(.*?)\\d').exec(this.TargetID);
			if (re)
				property = re[1];
			return property;
		};

		/** Simplified ID for the column on which to apply styling if the rule is true. */
		this.TargetID = targetID || '';

		/** Name of the column on which to apply styling if the rule is true. */
		this.TargetName = obiee.getColNameFromID(this.TargetID, columnMap, this.Dataset) || '';

		/** Value the rule has to match. */
		this.Value = val || '';

		/** Operator ID for the formatting rule. Can be one of 'equal', 'notEqual', 'greater', 'greaterOrEqual', 'less', 'lessOrEqual' or 'heatmap'. */
		this.Operator = op || 'equal';

		style = style || {};

		/** Style object defining all of the attributes to apply when the rule matches. Currently only supports the `colour` property which requires a Hex value. */
		this.Style = {
			colour : style.colour || '#000000',
			icon : style.icon || ''
		};

		if ($.inArray(this.Operator, ['equal', 'notEqual', 'greater', 'greaterOrEqual', 'less', 'lessOrEqual', 'heatmap']) == -1)
			throw 'Invalid operator "'+op+'" passed to conditional format.';

		/**
			* Compares a given value against the rule and returns a boolean to indicate a match.
			* Alternatively, a whole row of data can be passed and the correct column will be automatically identified.
			* @param {string|number|object} value Row of data or value to match against the conditional formatting rule.
			* @returns {boolean} Indicates whether the rule has matched or not.
		*/
		this.compare = function(value) {
			if ($.isPlainObject(value))
				value = getValueFromRow(value, this.SourceID);

			var comparison = false;
			switch(this.Operator) {
				case 'equal':
					comparison = value == this.Value;
					break;
				case 'notEqual':
					comparison = value != this.Value;
					break;
				case 'less':
					comparison = (+value < +this.Value);
					break;
				case 'lessOrEqual':
					comparison = (+value <= +this.Value);
					break;
				case 'greater':
					comparison = (+value > +this.Value);
					break;
				case 'greaterOrEqual':
					comparison = (+value >= +this.Value);
					break;
				default:
					comparison = false;
					break;
			}
			return comparison;
		};
	}

	/**
		@class
		* OBIEE presentation table object.
		* @param {string} code Code for the presentation table, usually the same as the name.
		* @param {string} name Name for the presentation table, usually the same as the code.
		* @param {Array.BIColumn[]} columns Array of `BIColumn` objects belonging to this table.
		* @param {string} [parent] Code of the parent table if it exists.
		* @param {Array.BITable[]} [children] Array of `BITable` objects indicating the child tables belonging to this table.
	*/
	obiee.BITable = function(code, name, desc, columns, parent, children) {
		/** Code for the presentation table, usually the same as the name. */
		this.Code = code;

		/** Name for the presentation table, usually the same as the code. */
		this.Name = name;

		/** Description for the presentation table. */
		this.Description = desc;

		/** columns Array of `BIColumn` objects belonging to this table. */
		this.Columns = columns;

		/** Code of the parent table if it exists. */
		this.Parent = parent || "";

		/** Array of `BITable` objects indicating the child tables belonging to this table. */
		this.Children = children || {};

		/** Hardcoded type identifier for the object: `Table`. */
		this.Type = 'Table';
	}

	/**
		@class
		* OBIEE variable object. Currently unused as logical SQL is generated using parameter on BIFilter objects specifying
		* the filter type. May eventually return to using this object for variables though.
		* @param {string} name Name of the variable
		* @param {string} type Type of the variable. Accepts either *Repository* or *Session*.
	*/
	obiee.BIVariable = function(name, type, values) {
		/** Variable name as defined in OBIEE. */
		this.Name = name;

		/** Variable type, either *Repository* or *Session*. */
		this.VarType = type || 'Repository'; // Type, repository or session
		if ($.inArray(this.VarType, ['Repository', 'Session', 'Presentation']) == -1)
			throw 'Invalid variable type "' + type + '" chosen.';

		var code;
		switch(this.VarType) {
			case 'Repository':
				code = 'VALUEOF("' + this.Name + '")';
				break;
			case 'Session':
				code = 'VALUEOF(NQ_SESSION."' + this.Name + '")';
				break;
		}

		/** OBIEE logical SQL representation for the variable. e.g. `VALUEOF(REP_VAR)`. */
		this.Code = code;

		/** Value of the variable that can be used in memory once fetched for a session. */
		this.Value = values || '';

		/** Hardcoded type identifier for the object: `Variable`. */
		this.Type = 'Variable'
	}

	/**
		@class
		* Object representing a filter. Can be applied to BIQuery objects to generate `WHERE` clauses in dynamic logical SQL.
		* @param {BIColumn} column OBIEE column to filter on.
		* @param {string} value Value to apply to the filter.
		* @param {string} [op=in] Operator for the filter action. Can be one of a limited set of values: `equal`, `notEqual`, `notIn`, `greater`,
		* `greaterOrEqual`, `less`, `lessOrEqual`, `top`, `bottom`, `like`, `contains`, `starts`, `ends`, `isNull`, `isNotNull`.
		* @param {string} [subjectArea=BIColumn.subjectArea] Subject area the filter belongs to.
		* @param {boolean} [global=false] Flag indicating whether the filter is global, i.e. implemented by a drilldown or dashboard prompt.
		* @param {boolean} [protect=false] Flag indicating whether to protect htis filter against prompts and interactions.
		* @param {string} [valueType=value] Type of the value, defaulting to `value`. Can be one of `value`, `expression`, `repVar`, `sessionVar`.
	*/
	obiee.BIFilter = function(column, value, op, subjectArea, global, protect, valueType, promptOptions) {

		/** OBIEE column code for the filter. */
		this.Code = column.Code;

		/** Name of the OBIEE column and hence the name of the filter column. */
		this.Name = column.Name;

		if (typeof(this.Code) == 'undefined' || this.Code == "")
			throw 'No code specifed for filter.';

		/** Flag to mark this filter as protected against drilldowns and prompts */
		this.Protected = protect || false;

		/** Operator for the filter action. Can be one of a limited set of values: `equal`, `notEqual`, `notIn`, `greater`,
			`greaterOrEqual`, `less`, `lessOrEqual`, `top`, `bottom`, `like`, `contains`, `starts`, `ends`, `isNull`, `isNotNull`. */
		this.Operator = op || 'in';

		if ($.inArray(this.Operator, [	'equal', 'notEqual', 'in', 'notIn', 'greater', 'greaterOrEqual', 'less', 'lessOrEqual', 'top', 'bottom',
							'like', 'contains', 'starts', 'ends', 'isNull', 'isNotNull']) == -1)
			throw 'Invalid operator "'+this.Operator+'" passed to filter.';

		var filterType;
		if ($.inArray(this.Operator, ['in', 'notIn']) > -1) {
			filterType = 'list';
			if (typeof(this.Value) == 'string')
				this.Value = [this.Value];
		} else if ($.inArray(this.Operator, ['top', 'bottom']) > -1)
			filterType = 'rank';
		else
			filterType = 'comparison';

		/** OBIEE filter type, based on the operator, used for building XML. */
		this.FilterType = filterType;

		var dataType = column.DataType, defaultVal;

		if ($.inArray(dataType, ['char', 'varchar']) > -1) {
			dataType = 'string'; defaultVal = [];
		} else if ($.inArray(dataType, ['integer', 'double', 'numeric']) > -1) {
			dataType = 'decimal', defaultVal = 0;
		} else if ($.inArray(dataType, ['date', 'timestamp']) > -1) {
			dataType = 'date'; defaultVal = null;
		}

		/** Value to filter on. */
		this.Value = value || defaultVal;

		/** Type of the value, defaulting to `value`. Can be one of `value`, `expression`, `repVar`, `sessionVar`. */
		this.ValueType = valueType || 'value';

		/** Column's data type. */
		this.DataType = dataType;

		/** Attribute indicating whether this filter was created/updated by a dashboard prompt or interaction */
		this.Global = global || false;

		/** Column ID so it can be referenced from a obiee.BIPres object. */
		this.ColumnID = column.ID;

		/** Introduces some information redundancy, optimise when possible. */
		this.Column = new obiee.BIColumn(column.Code, column.Name, column.DataType, column.Table, column.Measure, column.SubjectArea, column.DataFormat);;

		/** Subject area, optional as a BIQuery object will have this information, but can be useful for global filters. */
		this.SubjectArea = column.SubjectArea || "";

		var defaultStyle = 'picklist';
		if (this.DataType == 'date') {
			defaultStyle = 'datepicker';
		} else if (this.Column.Measure != 'none') { // Measures should be treated as numbers
			defaultStyle = 'numbox';
		}

		var defaultQuery = new obiee.BIQuery([this.Column], [])
		defaultQuery.MaxRows = 100;

		/**
			* Options for when using this filter in a prompt.
			* @property {string} Style Indicates UI style that the prompt will render as. Defaults to `picklist`.
			* @property {string} SQLOverride Contains logical SQL to use when fetching options for the dashboard prompt.
			* @property {string} DefaultType Has value type for the default prompt option. Can be one of: `value`, `expression`, `repVar`, `sessionVar`.
			* @property {boolean} GoLess  Boolean operator indicating whether the prompt should update reports as soon as it changes or not.
			* @property {boolean} OverrideDefault Boolean variable indicating whether the default value should be override. Set to true when drilling between analyses.
			* @property {boolean} MultipleValues Boolean variable indiciating whether more than one value can be selected at a time.
			* @property {string} PresVar Name of presentation variable this prompt should set.
			* @property {string[]} ProtectedQueries List of queries in the dashboard for which this prompt filter does not apply to.
			* If the list is empty, will assume that all apply
		*/

		var defaultOptions = {
			'Style' : defaultStyle,
			'ChoiceType': "lsql",
			'SQLOverride' :  defaultQuery.lsql(),
			'DefaultValues' : [],
			'GoLess' : true,
			'OverrideDefault' : false,
			'MultipleValues': true,
			'PresVar': '',
			'SubOptions': {
				min: 0,
				max: 100,
				choices: []
			},
			'ProtectedQueries': []
		}

		if (promptOptions) {
			promptOptions = $.extend(true, defaultOptions, promptOptions);
		}
		this.PromptOptions = promptOptions || defaultOptions;

		/** Updates `PromptOptions.ProtectedQueries` property with new new visualisations, datasets and display names. */
		this.updateQueries = function(visuals) {
			var filter = this;
			visuals.forEach(function(vis) {
				findVis = filter.PromptOptions.ProtectedQueries.filter(function(tv) {
					return tv.name == vis.Name;
				});

				if (findVis.length > 0) {
					findVis[0].displayName = vis.DisplayName;
				} else {
					var dataset = false;
					if (rmvpp.checkMulti(vis.Plugin)) {
						dataset = {};
						obiee.applyToColumnSets({}, vis.Plugin, function(item, ds) {
							dataset[ds] = {'enabled': false};
						});
					}
					filter.PromptOptions.ProtectedQueries.push({
						'enabled': false,
						'name': vis.Name,
						'displayName': vis.DisplayName,
						'dataset': dataset
					});
				}
			});
		}

		/** Hardcoded object identifier, `Filter`. */
		this.Type = 'Filter';
	}

	/**
		@class
		* Group object for filters, contains an array of `BIFilter` objects to be grouped with an `AND` or `OR` logical operator.
		* @param {BIFilter[]} filters Array of filters to be grouped by the logical operator.
		* @param {string} [op=and] Logical operator, can be one of: `and`, `or`.
	*/
	obiee.BIFilterGroup = function(filters, op) {
		/** Array of filters to be grouped by the logical operator. */
		this.Filters = filters;

		/** Logical operator, can be one of: `and`, `or`. */
		this.Operator = op || 'and';
		if ($.inArray(op, ['and', 'or']) == -1)
			throw 'Invalid operator "'+op+'" passed to filter group.';

		/** Hardcoded object identifier, `FilterGroup`. */
		this.Type = 'FilterGroup';
	}

	/**
		@class
		* Sort object specifies columns of criteria to sort by.
		* @param {string|integer} col References columns in criteria by Name attribute (string) or position in the Criteria array (integer).
		* @param {string} [dir=asc] Sort direction, can be one of: `asc`, `desc`.
	*/
	obiee.BISort = function(col, dir) {
		/** Use string to reference name, integer to reference position. */
		this.Column = col;

		dir = dir || 'asc';
		/** Sort direction, can be one of: `asc`, `desc`. */
		this.Direction = dir.toLowerCase();
		if ($.inArray(dir.toLowerCase(), ['asc', 'desc']) == -1)
			throw 'Invalid sort direction "'+dir+'" passed to sort object.';

		/** Hardcoded object identifier, `Sort`. */
		this.Type = 'Sort';
	}

	/**
		@class
		* Object representing a query against the BI server. Uses a subject area andarrays of BIColumn, BIFilter and BISort objects
		* to construct logical SQL to execute against the BI server.
		* @param {string} subjectArea OBIEE subject area for the query
		* @param {BIColumn[]} cols Array of BIColumn objects representing the criteria for the query.
		* @param {BIFilter[]} filters Array of BIFilter objects used to build the `WHERE` clause.
		* @param {BISort[]} sort Array of BISort objects used to build the `ORDER BY` clause.
	*/
	obiee.BIQuery = function(cols, filters, sort) {
		/** Array of BIColumn objects representing the criteria for the query. These will appear in the `SELECT` clause. */
		this.Criteria = cols;

		/**
			* Assigns a default subject area based on the criteria assigned.
			* @returns {string} OBIEE Subject Area for the query.
		*/
		this.defaultSubjectArea = function() {
			return ($.isArray(cols) && cols.length > 0) ? cols[0].SubjectArea : '';
		}

		/** OBIEE subject area for the query. */
		this.SubjectArea = this.defaultSubjectArea();

		filters = filters || [];
		if (!$.isArray(filters)) {
			throw 'Filters not passed through as an array to query.'
		}

		/** Array of BIFilter objects used to build the `WHERE` clause. */
		this.Filters = filters;

		/** Array of BISort objects used to build the `ORDER BY` clause. The order of the array will determine the sort order. */
		this.Sort = [] || sort;

		/** Maximum rows that should be returned by the logical SQL. Will append a `FETCH x ROWS` clause to the end of the LSQL. */
		this.MaxRows = 65000;

		/** Hardcoded object identified, `Query`. */
		this.Type = 'Query';

		/**
			* Generates logical SQL dynamically from the properties.
			* @returns {string} Logical SQL to be executed when the query is run.
		*/
		this.lsql = function() {
			return buildLSQL(this);
		};

		/**
			* Execute the query against the BI server.
			* @param {function} Callback function to execute on success, passing the result set.
			* @param {functino} Callback function to execute on failure, passing an object describing the error and LSQL.
		**/
		this.run = function(successFunc, errFunc) {
			var query = this;

			// Convert any variables into column objects
			query.Criteria.forEach(function(col) {
				if (col.Type == 'Variable')
					col = new obiee.BIColumn (col.Code, col.Name);
			});

			addSortColumns(query.Criteria);

			// XML execution is inferior in 11.1.1.9 and above
			// var xml = buildXML(this);
			// executeXML(xml, successFunc, query, errFunc);
			obiee.executeLSQL(query.lsql(), successFunc, query, errFunc);
		};
	}

	/**
		* @class
		* Presentation tables and columns for a given subject area.
		* @param {string} subjectArea Subject area name
		* @param {object} columns Object of BIColumns, with column IDs (Table.Column) as the property names
		* @param {array} tables Array of BITable objects
		* @see BIColumn
		* @see BITable
	*/
	obiee.BIPres = function(subjectArea, columns, tables) {
		/** Subject area name. */
		this.SubjectArea = subjectArea;

		/** Flattened object of all presentation columns (BIColumn), with column IDs (Table.Column) as the property names. */
		this.AllColumns = columns;

		/** Hierarchical array of presentation tables (BITable) with table names as the property names. Child tables stored in `Children` property of each table. */
		this.Tables = tables;

		/**
			Adds a BIColumn to the metadata object.
			@param {BIColumn} biColumn Presentation column to add
		*/
		this.addColumn = function(biColumn) {
			colCode = biColumn.Table + '.' + biColumn.Name;
			this.AllColumns[colCode] = biColumn;

			if (biColumn.Table in this.Tables) {
				this.Tables[biColumn.Table].Columns[biColumn.Name] = biColumn;
			} else {
				var columns = {};
				columns[biColumn.Name] = biColumn;
				this.Tables[biColumn.Table] = new obiee.BITable(biColumn.Table, biColumn.Table, '', columns);
			}
		}

		/** Hardcoded type identifier for the object: `Presentation`. */
		this.Type = 'Presentation';
	}

	/**
		* @class
		* Class representing a visualisation, featuring a query and mapping to a plugin as well as defined
		* configuration for that plugin.
		* @param {string} plugin ID for the plugin to use, specified in the plugin's `js` file.
		* @param {object} [config=rmvpp.getDefaultConfig] Object containing all configuration parameters set for this visualisation.
		* @param {object} [columnMap=rmvpp.getDefaultColumnMap] Object mapping `BIColumn` objects to parameters for defined by the plugin.
		* @param {BIQuery} [query] BIQuery object used to fetch the data for the visualisation.
		* @param {double} [x=0] X co-ordinate for placing on the screen.
		* @param {double} [y=0] Y co-ordinate for placing on the screen.
		* @param {integer} id Identifier for the visual, required in dashboards to maintain context between multiple visuals
		* and interactivity.
		* @param {string} [name=this.defaultName()] Name of the plugin.
		* @param {BIConditionalFormat[]} [cfs] Array of BIConditionalFormat objects for conditional formatting.
		* @param {DOM} container DOM element in which to render the visualisation.
	*/
	obiee.BIVisual = function(plugin, config, columnMap, query, x, y, id, name, cfs, displayName) {
		/** ID for the plugin to use, specified in the plugin's `js` file. */
		this.Plugin = plugin;

		/** Object containing all configuration parameters set for this visualisation. Parameters are
			specified by the plugin designer and are in the plugin's `js` file. Defaults to an object of the
			correct structure for the plugin with default attributes assigned. */
		this.Config = config || rmvpp.getDefaultConfig(plugin);

		/** Object mapping `BIColumn` objects to parameters for defined by the plugin. E.g. bar chart
			has parameters category and measure, which need the right columns associated to render the visual correctly.
			Column map parameters can also hold arrays of multiple `BIColumn` objects if the `multiple` attribute is set to
			`true` in the plugin. Defaults to an object of the correct structure for the plugin with no columns assigned. */
		this.ColumnMap = columnMap || rmvpp.getDefaultColumnMap(plugin);

		/** BIQuery object used to fetch the data for the visualisation. */
		this.Query = query || new obiee.BIQuery([], []);

		/** X co-ordinate for placing on the screen. */
		this.X = x || 0;

		/** Y co-ordinate for placing on the screen. */
		this.Y = y || 0;

		if (id === 0)
			id = 0;
		else
			id = id || -1;

		/** Zero-based numeric identifier for the visualisation on the page. Populates the `vis-number` property on the container element.  */
		this.ID = id;

		/** Generates a default name of the format: `<displayName> (<id>)`. E.g. Bar Chart (1). */
		this.defaultName = function() {
			return rmvpp.Plugins[this.Plugin].displayName + ' (' + (this.ID+1) + ')';
		}

		/** Name of the plugin, defaulting to the plugin description with the ID in brackets. E.g. 'Bar Chart (1)'. */
		this.Name = name || this.defaultName();

		/** Display name shown to the user. Arbitrary unlike the Name property which is required for functionality. */
		this.DisplayName = displayName || this.Name;

		/** Array of BIConditionalFormat objects for conditional formatting.*/
		this.ConditionalFormats = cfs || [];

		/**  DOM element in which to render the visualisation. */
		this.Container;

		/** Contains raw dataset for OBIEE query, saved by `render` method. */
		this.Data = obiee.applyToColumnSets({}, this.Plugin, function() { return []; });

		/** Boolean property indicating whether the query should be refreshed from OBIEE on next execution.
			Normally true, but set to false by visualisation selectors. */
		this.Refresh = 0;

		/** Hardcoded type identifier, `Visual`. */
		this.Type = 'Visual';

		/**
			* Reset to default column config if required and if incorrect config is set. Checked against the plugin type.
			* @param {boolean} cleanup If specified, function will set the column configuration to an empty object if configuration exists and the plugin does not match.
		*/
		this.resetColumnConfig = function(cleanup) {
			var vis = this;
			vis.ColumnMap = obiee.applyToColumnSets(vis.ColumnMap, vis.Plugin, function(colMap, dataset) {
				colMap = obiee.applyToColumnMap(colMap, function(col, prop) {
					var configParams = rmvpp.Plugins[vis.Plugin].columnMappingParameters;
					if (dataset) {
						configParams = configParams[dataset];
					}

					configParams = configParams.filter(function(cp) {
						return obiee.getPropFromID(prop) == cp.targetProperty;
					})[0].config;

					if (configParams) {
						if (!col.Config || vis.Plugin != col.Config.Plugin) {
							col.Config = rmvpp.getDefaultColumnConfig(configParams);
						}
					} else if (cleanup && (vis.Plugin != col.Config.Plugin)) {
						col.Config = {};
					}
				});
				return colMap;
			});
		}

		/**
			Render visual in `container`. Runs a query against the BI server then executes the plugin's render
			function on success. The plugin render function receives the following: `data`, `columnMap`,
			`container`, `conditionalFormats`.
		*/
		this.render = function(scope, callback) {
			var vis = this, dfdArray = [], allCriteria = [];

			// Get array of all criteria from queries, even with multiple datasets.
			obiee.applyToColumnSets(vis.Query, vis.Plugin, function(query, dataset) {
				allCriteria = allCriteria.concat(query.Criteria);
				return dataset ? vis.Query[dataset] : vis.Query;
			});

			/** Called just before the visualisation is rendered. */
			function preVisRender(vis) {
				$(vis.Container).empty(); // Clear loading animation
				vis.Refresh = true;
			}

			/** Called just after the visualisation is rendered. */
			function postVisRender(vis, scope) {
				if (scope) {
					scope.$emit('refreshInteractions', vis); // Send event to dashboard to refresh interactions
				}
			}

			/** Executes query returning a deferred object so that multiple queries can be handled nicely. */
			function runQuery(query, dataset) {
				var dfd = $.Deferred(); // Deferred for multiple asynchronous execution
				query.run(function(results) {
					if (dataset) {
						results = {'results': results, 'dataset' : dataset};
					}
					dfd.resolve(results);
				}, function(err) {
					if (dataset) {
						err = {'error': err, 'dataset' : dataset};
					}
					dfd.reject(err);
				});
				return dfd.promise();
			}

			function staticRender(vis, scope, callback) {
				preVisRender(vis);
				var data = mapDataMulti(vis.Data, vis);

				rmvpp.Plugins[vis.Plugin].render(data, vis.ColumnMap, vis.Config, $(vis.Container)[0], vis.ConditionalFormats);
				postVisRender(vis, scope);

				if (callback) {
					callback();
				}
			}

			function errorRender(error, query) {
				var err = obiee.getErrorDetail(error);
				rmvpp.displayError($(vis.Container)[0], err.basic + '\n\n' + query.lsql());
			}

			if (allCriteria.length > 0) { // Don't attempt to render visualisation if no columns passed
				$(vis.Container).empty().off(); // Clear and disable interactions
				$(vis.Container).addClass('visualisation');
				$(vis.Container).attr('vis-number', this.ID);

				rmvpp.loadingScreen(vis.Container); // Add loading animation
				vis.resetColumnConfig();

				if (!rmvpp.Plugins[vis.Plugin].multipleDatasets) { // Single dataset handler
					if (vis.Data.length == 0 || (vis.Refresh > 0)) {
						dfdArray.push(runQuery(vis.Query));
						$.when.apply($, dfdArray).then(function(results) {
							vis.Data = angular.copy(results); // Keep the raw data

							preVisRender(vis);
							data = mapData(results, vis.ColumnMap); // Map data to visualisation format
							if (data.length > 0) {
								rmvpp.Plugins[vis.Plugin].render(data, vis.ColumnMap, vis.Config, $(vis.Container)[0], vis.ConditionalFormats);
								postVisRender(vis, scope);
							} else {
								rmvpp.displayError($(vis.Container)[0], 'No data, cannot render visual.')
							}

							if (callback) {
								callback();
							}
						}, function(err) {
							errorRender(err, vis.Query);
						});
					} else {  // Don't re-run the queries if we have data already. Refresh property will override this.
						staticRender(vis, scope, callback);
					}
				} else { // Multiple dataset handler
					if (Object.values(vis.Data).every(function(v) { return v.length == 0; }) || (vis.Refresh > 0)) {
						for (dataset in vis.Query) {
							if (vis.Query[dataset].Criteria.length > 0) {
								dfdArray.push(runQuery(vis.Query[dataset], dataset));
							}
						}

						$.when.all(dfdArray).then(function(results) {
							var rawResults = {};
							results.forEach(function(resultSet) {
								rawResults[resultSet.dataset] = resultSet.results;
							});
							vis.Data = angular.copy(rawResults);

							preVisRender(vis);
							var data = mapDataMulti(rawResults, vis);

							if (Object.values(vis.Data).some(function(v) { return v.length > 0; })) { // Check if any result sets are present
								rmvpp.Plugins[vis.Plugin].render(data, vis.ColumnMap, vis.Config, $(vis.Container)[0], vis.ConditionalFormats);
								postVisRender(vis, scope);
							} else {
								rmvpp.displayError($(vis.Container)[0], 'No data, cannot render visual.')
							}

							if (callback) {
								callback();
							}
						}, function(err) {
						     errorRender(err[0].error, vis.Query[err[0].dataset]); // Report on the first error
						});
					} else {  // Don't re-run the queries if we have data already. Refresh property will override this.
						staticRender(vis, scope, callback);
					}
				}
			}
		};

		/* Reset display name to the default if it matches the default pattern. */
		this.resetName = function() {
			if (/.*?\(\d.*?\)/.test(this.DisplayName)) {
				this.DisplayName = this.defaultName();
			}
		}
	}

	/**
		* @class
		* Contains information for interactivity between multiple visualisations on a page.
		* @param {BIVisual} sourceVis Source visualisation object, this contains the trigger for the interaction.
		* @param {BIVisual} targetVis Target visualisation object, this reacts to the interaction.
		* @param {string} [trigger=this.getDefaultTrigger] Custom event to be triggered.  Possible values are specified by the `actions` property of the source plugin.
		* @param {string} [action=this.getDefaultAction] Action to be performed on the target visualisation.
		* Possible values are specified by the `reactions` property of the target plugin.
		* @param {array} [columns=getDefaultColumns] Array of column identifiers to pass to the interaction.
		* Possible values defined by the `columnMappingParameters` property of the source plugin.
		* @param {function} [handler=insights.generateHandler] JavaScript handler for the UI interaction. This is governed by the framework, but can be optionally
		* passed in to allow deletion or inactivation of interactions.
	*/
	obiee.BIInteraction = function(sourceVis, targetVis, trigger, action, columns, handler) {
		/** `BIVisual` object describing the source visualisation. */
		this.SourceVis = sourceVis;

		/** `BIVisual` object describing the target visualisation. */
		this.TargetVis = targetVis;

		/** Zero-based numeric identifier for the source visualisation. */
		this.SourceNum = sourceVis.ID;

		/** Zero-based numeric identifier for the target visualisation. */
		this.TargetNum = targetVis.ID;

		/** Gets the default trigger ID, the first in the `actions` list for the source plugin. */
		this.getDefaultTrigger = function() {
			return rmvpp.Plugins[this.SourceVis.Plugin].actions.map(function(a) { return a.trigger; })[0];
		}

		/** Gets the default reaction ID, the first in the `reactions` list for the target plugin. */
		this.getDefaultAction = function() {
			return rmvpp.Plugins[this.TargetVis.Plugin].reactions.map(function(a) { return a.id; })[0];
		}

		/** Gets default column object from source visual, comprised of all columns from the `columnMappingParameters` of the source visualisation. */
		this.getDefaultColumns = function () {
			return getDefaultColumns(this);
		};

		/** Custom event to be triggered. Possible values are specified by the `actions` property of the source plugin. */
		this.Trigger = trigger || this.getDefaultTrigger();

		/** Action to be performed on the target visualisation. Possible values defined by the `columnMappingParameters` property of the source plugin. */
		this.Action = action || this.getDefaultAction(); // Action to be performed on the target visualisation. Default to filter

		/** Array of column identifiers to pass to the interaction. Possible values defined by the `columnMappingParameters` property of the source plugin. */
		this.Columns = columns || this.getDefaultColumns(); // Array of column identifiers to use from the plugin map

		/** JavaScript handler for the UI interaction, created used `insights.generateHandler`. */
		this.Handler = handler || insights.generateHandler(this.Action, this.SourceVis, this.TargetVis, this.Columns); // Generate handler

		/** Hardcoded type identifier, `Interaction`. */
		this.Type = 'Interaction';

		/**
			* Enable the interaction using `insights.createInteraction`.
			* @param {scope} scope Angular scope can be passed as an argument so that Angular events can be sent later
		*/
		this.enable = function(scope) {
			obiee.createInteraction(this, scope);
		}

		/** Disables the interaction using `insights.removeInteraction`. */
		this.disable = function() {
			obiee.removeInteraction(this);
		}

		/** Name of the source trigger used in the interaction. */
		this.triggerName = function () {
			var trigger = this.Trigger;
			return rmvpp.Plugins[this.SourceVis.Plugin].actions.filter(function(a) { return trigger == a.trigger; })[0].name;
		}

		/** Name of the target reaction used for the interaction. */
		this.actionName = function () {
			var action = this.Action;
			return rmvpp.Plugins[this.TargetVis.Plugin].reactions.filter(function(a) { return action == a.id; })[0].name;
		}
	}

	/**
		* @class
		* Contains information for drilldown from one visualisation to another dashboard page in the catalogue.
		* Filters can be passed to the target page in much the same as dashboard prompts work.
		* Shares the interactivity framework so the same plugin triggers can be used. Breadcrumbs will be provided to navigate back through multiple drills.
		* @param {BIVisual} sourceVis Source visualisation object, this contains the trigger for the interaction.
		* @param {string} drillPath Web catalogue path for the target dashboard page.
		* @param {string} [trigger=this.getDefaultTrigger] Custom event to be triggered.  Possible values are specified by the `actions` property of the source plugin.
		* @param {array} [columns=this.getDefaultColumns] Array of column identifiers to pass to the interaction.
		* Possible values defined by the `columnMappingParameters` property of the source plugin.
		* @param {string} [sourcePath=""] Catalogue path of the source dashboard path that can be used to construct breadcrumbs.
		* @param {BIBreadcrumb[]} [breadcrumbs=[]] Array of `BIBreadcrumb` objects indicating the complete drill path after one or more drill actions.
		* @param {function} [handler=insights.generateHandler] JavaScript handler for the UI interaction. This is governed by the framework, but can be optionally
		* passed in to allow deletion or inactivation of interactions.
	*/
	obiee.BIDrilldown = function(sourceVis, drillPath, trigger, columns, sourcePath, breadcrumbs, handler) {
		/** `BIVisual` object describing the source visualisation. */
		this.SourceVis = sourceVis;

		/** Zero-based numeric identifier for the source visualisation. */
		this.SourceNum = sourceVis.ID;

		/** Web catalogue path for the target dashboard page. */
		this.DrillPath = drillPath || "";

		/** Catalogue path of the source dashboard path that can be used to construct breadcrumbs. */
		this.SourcePath = sourcePath || "";

		/** Action name akin to that of `BIInteraction` properties and is hardcoded to `drill`. */
		this.Action = 'drill';

		/** Array of `BIBreadcrumb` objects indicating the complete drill path after one or more drill actions. */
		this.Breadcrumbs = breadcrumbs || [];

		/** Hardcoded type identifier, `Drilldown`. */
		this.Type = 'Drilldown';

		/** Gets the default trigger ID, the first in the `actions` list for the source plugin. */
		this.getDefaultTrigger = function() {
			return rmvpp.Plugins[this.SourceVis.Plugin].actions.map(function(a) { return a.trigger; })[0];
		}

		/** Gets default column object from source visual, comprised of all columns from the `columnMappingParameters` of the source visualisation. */
		this.getDefaultColumns = function () {
			return getDefaultColumns(this);
		};

		/** Custom event to be triggered. Possible values are specified by the `actions` property of the source plugin. */
		this.Trigger = trigger || this.getDefaultTrigger();

		/** Array of column identifiers to pass to the interaction. Possible values defined by the `columnMappingParameters` property of the source plugin. */
		this.Columns = columns || this.getDefaultColumns(); // Array of column identifiers to use from the plugin map

		// Parameters required to develop breadcrumb history
		var drillParams =  {
			'sourcePath' : this.SourcePath,
			'targetPath' : this.DrillPath,
			'breadcrumbs' : this.Breadcrumbs
		};
		/** JavaScript handler for the UI interaction, created used `insights.generateHandler`. */
		this.Handler = handler || insights.generateHandler('drill', this.SourceVis, drillParams, this.Columns);

		/**
			* Enable the interaction using `insights.createInteraction`.
			* @param {scope} scope Angular scope can be passed as an argument so that Angular events can be sent later
		*/
		this.enable = function(scope) {
			obiee.createInteraction(this, scope);
		};

		/** Disables the interaction using `insights.removeInteraction`. */
		this.disable = function() {
			obiee.removeInteraction(this);
		};

		/** Name of the source trigger used in the interaction. */
		this.triggerName = function () {
			var trigger = this.Trigger;
			return rmvpp.Plugins[this.SourceVis.Plugin].actions.filter(function(a) { return trigger == a.trigger; })[0].name;
		}
	}

	/**
		* @class
		* Contains information to allow return navigation after one or more drilldown events.
		* @param {string} sourcePath Web catalogue path of original dashboard page.
		* @param {string} targetPath Web catalogue path of original dashboard page.
		* @param {object} drillFilter Column and value object as passed by the original interaction. Accepts format returned by `rmvpp.actionColumnMap`.
	*/
	obiee.BIBreadcrumb = function(sourcePath, targetPath, drillFilter) {
		/** Web catalogue path of original dashboard page. */
		this.SourcePath = sourcePath;

		/** Web catalogue path of original dashboard page. */
		this.TargetPath = targetPath;

		/** Column and value object as passed by the original interaction. Accepts format returned by `rmvpp.actionColumnMap`. */
		this.DrillFilter = drillFilter;

		/** Hardcoded type identifier, `Breadcrumb`. */
		this.Type = 'Breadcrumb';
	}

	/**
		* @class
		* JavaScript object representing a dashboard prompt.
		* @param {BIFilter[]} [filters=[]] Array of `BIFilter` objects to use in dashboard prompt.
		* @param {integer} [x=0] X co-ordinate to position the prompt on the page.
		* @param {integer} [y=0] Y co-ordinate to position the prompt on the page.
	*/
	obiee.BIPrompt = function(filters, x, y) {
		/** Array of `BIFilter` objects to use in dashboard prompt. */
		this.Filters = filters || [];

		var prompt = this;
		this.Filters.forEach(function(f, i) {
			prompt.Filters[i] = new obiee.BIFilter(f.Column, f.Value, f.Operator, f.SubjectArea, f.Global, f.Protected, f.ValueType, f.PromptOptions);
		});

		/** Array of booleans used to keep track of which filters have been populated with options from OBIEE. */
		this.Populated = this.Filters.map(function(f) {
			return false;
		});

		/** X co-ordinate to position the prompt on the page. */
		this.X = x || 0;

		/** Y co-ordinate to position the prompt on the page. */
		this.Y = y || 0;

		/** Hardcoded type identifier, `Prompt` */
		this.Type = 'Prompt'

		/**
			* Update visualisation with prompted values.
			* @param {BIVisual} vis Visualisation to update filters for.
			* @returns {boolean} Indicates whether or not hte visualisation has been updated or not.
		*/
		this.promptVisFilters = function(vis) {
			var promptFilters = this.Filters;
			var refreshVis = [], visNum = vis.ID;

			obiee.applyToColumnSets(vis.Query, vis.Plugin, function(query) { // Cater for multiple dataset plugins
				refreshVis.push(obiee.removePromptedFilters(query.Filters)); // Remove existing explicit global filters
				return query;
			});

			// If any of the queries need refreshing, refresh the visualisation.
			refreshVis = refreshVis.some(function(v) { return v; });

			obiee.applyToColumnSets(vis.Query, vis.Plugin, function(query, ds) { // Apply to all queries
				promptFilters.forEach(function(filter, j) {
					var allowed = true;
					if (rmvpp.checkMulti(vis.Plugin)) {
						var findVis = filter.PromptOptions.ProtectedQueries.filter(function(pq) {
							return pq.name == vis.Name
						});
						if (findVis.length > 0) {
							allowed = !findVis[0].dataset[ds].enabled; // Allow the filter if the query is unprotected
						}

					} else {
						// Check that the visualisation is not marked to ignore prompted filters
						var protectedVis = filter.PromptOptions.ProtectedQueries.filter(function(pq) {
							return pq.enabled;
						});
						allowed = $.inArray(vis.Name, protectedVis.map(function(d) { return d.name; })) == -1;
					}

					if (allowed) {
						if (filter.SubjectArea == query.SubjectArea) { // Check subject areas match and value is not blank
							var filterFound = false; // Search for filter on same code and update if found
							origFilters = query.Filters;
							filterFound = obiee.replaceFilter(origFilters, filter);

							if (!filterFound) {
								filter.Global = true;
								query.Filters.push(filter);
							}

							if (filterFound != 'protected') {
								refreshVis = true;
							}
						}
					}
				});
				return query;
			});

			return refreshVis;
		}
	}

	/**
		* @class
		* Represents a column selector allowing switching of columns for any applicable visualisations on a page.
		* @param {BIColumn[]} [columns=[]] Designates list of columns to choose between.
		* @param {object[]} [visuals=[]] List of visualisation names to which column selector should be applied.
		* @param {integer} [x=0] X co-ordinate to position the selector on the page.
		* @param {integer} [y=0] Y co-ordinate to position the selector on the page.
		* @param {string} [style='Dropdown'] Designates the UI style for the column. Can be on of: 'Dropdown', 'Radio'.
	*/
	obiee.BIColumnSelector = function(columns, visuals, x, y, style) {
		/** Designates list of columns to choose between. */
		this.Columns = columns || [];

		/** List of visualisation names to which selector should be applied. Each element is an object with properties `name` (string) and `enabled` (boolean). */
		this.Visuals = visuals || [];

		/** Designates the UI style for the column. Can be on of: 'Dropdown', 'Radio'. */
		this.Style = style || 'Dropdown';
		if ($.inArray(this.Style, ['Dropdown', 'Radio']) == -1)
			throw 'Invalid style "' + style + '" chosen.';

		/** X co-ordinate to position the selector on the page. */
		this.X = x || 0;

		/** Y co-ordinate to position the selector on the page. */
		this.Y = y || 0;

		/** Updates `Visuals` property with new new visualisations and display names. */
		this.updateVisuals = function(visuals) {
			var cs = this;
			visuals.forEach(function(vis) {
				findVis = cs.Visuals.filter(function(tv) {
					return tv.name == vis.Name;
				});

				if (findVis.length > 0) {
					findVis[0].displayName = vis.DisplayName;
				} else {
					var dataset = false;
					if (rmvpp.checkMulti(vis.Plugin)) {
						dataset = {};
						obiee.applyToColumnSets({}, vis.Plugin, function(item, ds) {
							dataset[ds] = {'enabled': true};
						});
					}
					cs.Visuals.push({
						'enabled': true,
						'name': vis.Name,
						'displayName': vis.DisplayName,
						'dataset': dataset
					});
				}
			});
		}

		/** Hardcoded type identifier, `ColumnSelector` */
		this.Type = 'ColumnSelector';
	}

	/**
		* @class
		* Represents a visualisation selector allowing switching between visualisations/queries using a UI element (e.g. dropdown, radio).
		* @param {integer[]} [visuals=[]] List of names and booleans indicating which visualisations to include in the selector.
		* @param {integer} [x=0] X co-ordinate to position the selector on the page.
		* @param {integer} [y=0] Y co-ordinate to position the selector on the page.
		* @param {string} [style='Dropdown'] Designates the UI style for the column. Can be on of: 'Dropdown', 'Radio'.
		* @param {string} [selected=this.selectDefault()] Default visualisation selected.
	*/
	obiee.BIVisualSelector = function(visuals, x, y, style, selected, defaultVal) {
		/** List of visualisation IDs to which selector should contain. Each element is an object with properties `name` (string) and `enabled` (boolean). */
		this.Visuals = visuals || [];

		/** Selects default visualisation, first in the array. */
		this.selectDefault = function() {
			if (this.Default)
				return this.Default;
			else
				return this.Visuals.length > 0 ? this.Visuals[0].name : '';
		}

		/** Name of the currently active visualisation */
		this.Selected = selected || this.selectDefault();

		this.Default = defaultVal || '';

		/** Designates the UI style for the column. Can be on of: 'Dropdown', 'Radio'. */
		this.Style = style || 'Dropdown';
		if ($.inArray(this.Style, ['Dropdown', 'Radio']) == -1)
			throw 'Invalid style "' + style + '" chosen.';

		/** X co-ordinate to position the selector on the page. */
		this.X = x || 0;

		/** Y co-ordinate to position the selector on the page. */
		this.Y = y || 0;

		/** Hardcoded type identifier, `VisualSelector` */
		this.Type = 'VisualSelector';
	}


	/**
		* @class
		* Represents a complete dashboard page, including prompts, selectors, interactivity and drilldowns.
		* @param {BIVisual[]} [visuals=[]] Visualisations to be included on the page.
		* @param {BIPrompt} [prompts={}] Dashboard prompts to be included on the page.
		* @param {BIInteraction[]} [interactions=[]] Interactions between visualisations on page.
		* @param {BIColumnSelector[]} [selectors=[]] Column selectors to be included on the page.
		* @param {BIDrilldown[]} [drilldowns=[]] Drilldowns to be included on the page.
		* @param {string} [path=""] Web catalogue path in which the page is saved.
		* @param {BIBreadcrumb[]} [breadcrumbs=[]] Breadcrumbs if page has been drilled to.
		* @param {BIVisualSelector[]} [selectors=[]] Visualisation selectors to be included on the page.
		* @param {BICanvas} [canvas=null] Canvas containing annotations on the page.
	*/
	obiee.BIDashboardPage = function(visuals, prompts, interactions, colSelectors, drilldowns, path, breadcrumbs, visSelectors, canvas, hiddenVisuals) {
		/** Visualisations to be included on the page. */
		this.Visuals = visuals || [];

		/** Visualisations included in the object but not displayed on the page. Useful for saving things in edit mode whilst developing. */
		this.HiddenVisuals = hiddenVisuals || [];

		/** Dashboard prompts to be included on the page. */
		this.Prompts = prompts || {};

		/** Interactions between visualisations on page. */
		this.Interactions = interactions || [];

		/** Column selectors to be included on the page. */
		this.ColumnSelectors = colSelectors || [];

		/** Visualisation selectors to be included on the page. */
		this.VisualSelectors = visSelectors || [];

		/** Drilldowns to be included on the page. */
		this.Drilldowns = drilldowns || [];

		/** Web catalogue path in which the page is saved. */
		this.Path = path || "";

		/** Breadcrumbs if page has been drilled to. */
		this.Breadcrumbs = breadcrumbs || [];

		/** Canvas object describing all custom drawing and annotations. */
		this.Canvas = canvas || {};

		/** Container DOM element that the dashboard page is rendered in. */
		this.Container;

		/**
			* Saves dashboard page to the web catalogue.
			* @param {string} path Web catalogue path to save the dashboard page to.
			* @param {function} successFunc Callback function  upon successful save.
		*/
		this.save = function(path, successFunc, errFunc) {
			cleanupDashboard(this);

			// Build HTML script to generate full visualisation
			var html = '';
			this.Path = path;

			html += visualisationHTML(this);
			var staticHTMLView = buildHTMLViewXML(html);

			// Set the custom view as the compound layout
			var compoundView = buildCompoundViewXML('rmvppView');

			var dummyCol = new obiee.BIColumn("'Dummy'", 'Dummy');
			var dummyQuery = new obiee.BIQuery([dummyCol]); // No need for filters or sort
			var xml = buildXML(dummyQuery, [staticHTMLView, compoundView]) // Use the first visualisation as the criteria. Arbitrary here anyway.
			saveXML(xml, path, successFunc, errFunc)
		};

		/** Gets the cached data for each visualisation (or executes against OBIEE if necessary) and
			exports the data to CSV files for download. One CSV is produced for each query/visualisation. */
		this.exportToCSV = function() {
			var visSelectors = this.VisualSelectors;

			// Escape bad characters in CSV
			function csvEscape(cell) {
				if (
					cell.indexOf('"') > -1 ||
					cell.indexOf('-') > -1 ||
					cell.indexOf(',') > -1 ||
					cell.indexOf('\n') > -1
				) {
					cell = cell.replace('"', '""');
					cell = '"'+cell+'"';
				}
				return cell;
			};

			// Create the CSV file for a visualisation and dataset
			function createCSV(data, filename) {
				var csvContent = "";
				if (data.length > 0) {
					// Header
					var header = [];
					for (col in data[0]) {
						header.push(col);
					}
					csvContent += header.join(',');
					csvContent += '\n';

					// Rows
					data.forEach(function(d) {
						var row = [];
						for (col in d) {
							var cell = d[col];
							if (typeof(cell) == 'string')
								cell = csvEscape(cell);
							row.push(cell);
						}
						csvContent += row.join(',');
						csvContent += '\n';
					});

					var blob = new Blob([csvContent], {type: "text/csv;charset=utf-8"});
					saveAs(blob, filename + '.csv');
				};
			}

			this.Visuals.forEach(function(vis) {
				if (obiee.showOrHideVis(visSelectors, vis)) { // If shown on page
					if (rmvpp.checkMulti(vis.Plugin)) {
						for (dataset in vis.Query) {
							var sheetName = vis.DisplayName + ' - ' + dataset;
							if (vis.Data[dataset].length == 0) { // Don't run the query if unnecessary
								vis.Query[dataset].run(function(data) {
									createCSV(data, sheetName);
								});
							} else {
								createCSV(vis.Data[dataset], sheetName);
							}
						}
					} else {
						if (vis.Data.length == 0) { // Don't run the query if unnecessary
							vis.Query.run(function(data) {
								createCSV(data, vis.DisplayName);
							});
						} else {
							createCSV(vis.Data, vis.DisplayName);
						}
					}
				}
			});
		};

		/** Gets the cached data for each visualisation (or executes against OBIEE if necessary) and
			exports the data to an Excel file for download. One worksheet is produced for each query/visualisation. */
		this.exportToXLSX = function() {
			var wbName = $.fileFromPath(this.Path);

			// Converts a dataset(array of arrays) to an Excel worksheet format
			function sheetFromData(data, columns) {
				// Converts date to an Excel number date format
				function datenum(v, date1904) {
					if(date1904) v+=1462;
					var epoch = Date.parse(v);
					return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
				}

				var ws = {};
				var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }}; // Maximum sheet size

				function setRange(R, C) {
					if(range.s.r > R) range.s.r = R;
					if(range.s.c > C) range.s.c = C;
					if(range.e.r < R) range.e.r = R;
					if(range.e.c < C) range.e.c = C;
				}

				// Headers
				R = 0, C =0;
				for (col in data[0]) {
					setRange(R,C);
					var cell = {v :  col, t: 's', s: {
						font: {bold: true},
						alignment: {horizontal: 'center'}
					}};
					var cell_ref = XLSX.utils.encode_cell({c:C,r:R});
					ws[cell_ref] = cell;
					C++;
				}

				// Add data
				for(var R = 1; R != data.length+1; ++R) { // Row index
					var C = 0; // Column index
					for (col in data[R-1]) {
						setRange(R, C);

						var colObj = columns.filter(function(c) { return c.Name == col; });
						if (colObj.length > 0)
							colObj = colObj[0];
						else
							colObj = false;

						var cell = {v: $.inArray(colObj.DataType, ['integer', 'double']) > -1 ? +data[R-1][col] : data[R-1][col]};
						if(cell.v == null) continue;
						var cell_ref = XLSX.utils.encode_cell({c:C,r:R});

						if(typeof cell.v === 'number') cell.t = 'n'; // Numbers
						else if(typeof cell.v === 'boolean') cell.t = 'b'; // Booleans
						else if(colObj.DataType == 'date') { // Handle dates
							var dtVal = new Date(data[R-1][col]);
							cell.t = 'n'; cell.z = XLSX.SSF._table[14];
							cell.v = datenum(dtVal);
						}
						else cell.t = 's';

						ws[cell_ref] = cell;
						C++;
					}
				}
				if(range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);
				return ws;
			};

			// Initialise Excel workbook object
			function Workbook() {
				if(!(this instanceof Workbook)) return new Workbook();
				this.SheetNames = [];
				this.Sheets = {};
			}

			var wb = new Workbook(); // Create new Excel workbook
			this.Visuals.forEach(function(vis) {
				if (obiee.showOrHideVis(visSelectors, vis)) { // If shown on page

					// Process extra sheets for plugins with multiple datasets
					if (rmvpp.checkMulti(vis.Plugin)) {
						for (dataset in vis.Query) {
							if (vis.Data[dataset].length > 0) {
								var sheetName = vis.DisplayName + ' - ' + dataset;
								wb.SheetNames.push(sheetName);
								var ws = sheetFromData(vis.Data[dataset], vis.Query[dataset].Criteria);
								wb.Sheets[sheetName] = ws;
							}
						}
					} else {
						if (vis.Data.length > 0) {
							wb.SheetNames.push(vis.DisplayName);
							var ws = sheetFromData(vis.Data, vis.Query.Criteria); // Use cached data for download
							wb.Sheets[vis.DisplayName] = ws;
						}
					}
				}
			});

			// Handle encoding of the XLSX file
			function s2ab(s) {
				var buf = new ArrayBuffer(s.length);
				var view = new Uint8Array(buf);
				for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
				return buf;
			}

			var wbout = XLSX.write(wb, {bookType:'xlsx', bookSST:true, type: 'binary'});
			saveAs(new Blob([s2ab(wbout)],{type:"application/octet-stream"}), wbName+".xlsx")
		}

		/**
			* Calculate the width of the dashboard page by summing the widths and positions of contained visualisations.
			* @returns {integer}
		*/
		this.getWidth = function() {
			var xVal = this.Visuals.map(function(v) {
				var width = +$(v.Container).width();
				if (width < 50) // Has not loaded yet
					width = v.Config.size ? +v.Config.size : +v.Config.width;
				return +v.X + width;
			});

			xVal.push(this.Canvas.Width);
			return d3.max(xVal);
		}

		/**
			* Calculate the height of the dashboard page by summing the heights and positions of contained visualisations.
			* @returns {integer}
		*/
		this.getHeight = function() {
			var yVal = this.Visuals.map(function(v) {
				var height = +$(v.Container).height();
				if (height < 50) // Has not loaded yet
					height = v.Config.size ? +v.Config.size : +v.Config.height;
				return +v.Y + height;
			});

			yVal.push(this.Canvas.Height);
			return d3.max(yVal);
		}

		/** Creates a canvas element if it doesn't already exist, otherwise refreshes. Creates in a descendent DOM element of the dashboard page
			with the `designLayer` class. */
		this.createCanvas = function() {
			if ($.isEmptyObject(this.Canvas) || !this.Canvas) {
				this.Canvas = new obiee.BICanvas({}, $(this.Container).find('.designLayer')[0], this.getWidth(), this.getHeight());
			} else {
				this.Canvas = this.Canvas.create($(this.Container).find('.designLayer')[0], this.getWidth(), this.getHeight());
			}
		}
	}

	/**
		* @class
		* Describes canvas element for custom drawing and annotations.
		* @param {object} [json={}] Fabric JSON export of the canvas object.
		* @param {DOM} [container] Dashboard page container element which is the parent of the canvas.
		* @param {width} [width=0] Canvas width in pixels.
		* @param {height} [height=0] Canvas height in pixels.
	*/
	obiee.BICanvas = function(json, container, width, height) {
		/** JSON representation of Fabric canvas with all custom annotations for the dashboard page. */
		if ($.isEmptyObject(json)) json = false;
		this.JSON = json || {};

		/** Gives the width of the canvas in pixels. */
		this.Width = width || 0;

		/** Gives the height of the canvas in pixels. */
		this.Height = height || 0;

		/** DOM container element for the canvas. */
		this.Container = container;

		/** Fabric canvas element containing all custom text and images on the dashboard. */
		this.Element;

		/**
			* Create a FabricJS canvas element and attaches it to `this.Element`. If it already exists, the function resizes and refreshes it.
			* @param {DOM} container Container element for the canvas
			* @param {width} Width of the canvas in pixels.
			* @param {height} Height of the canvas in pixels.
			* @returns canvas
		*/
		this.create = function(container, width, height) {
			var canvasJSON = this.JSON;
            var canvas = this;
			this.Container = container;

			if (!this.Element || !$(container).parent().hasClass('canvas-container')) {
				var designLayer = $(container)[0]

				this.Element = new fabric.Canvas(designLayer);
				this.Element.loadFromJSON(this.JSON, function() {
                    canvas.refresh(width, height);
                });

				return this;
			} else {
				this.refresh(width, height);
				return this;
			}
		}

		/**
			* Refreshes and resizes canvas element. Automatically expands canvas to contain all canvas objects.
			* @param {width} Width of the canvas in pixels.
			* @param {height} Height of the canvas in pixels.
		*/
		this.refresh = function(width, height) {
			var xVal = this.Element.getObjects().map(function(obj) { return obj.left + obj.getWidth(); });
			xVal.push(width), xVal.push(this.Element.getWidth());
			var yVal = this.Element.getObjects().map(function(obj) { return obj.top + obj.getHeight(); });
			yVal.push(height), yVal.push(this.Element.getHeight());;

			this.Element.setWidth(d3.max(xVal));
			this.Width = (d3.max(xVal));
			this.Element.setHeight(d3.max(yVal));
			this.Height = (d3.max(yVal))
			this.Element.renderAll();
		}

		/** Deselects all canvas objects. */
		this.deselectAll = function() {
			this.Element.deactivateAllWithDispatch().renderAll();
		}

		if (container)
			this.create(container, width, height);
	}

	/**
		* @class
		* Describes access control list object from OBIEE web catalogue security.
		* @param {object} [acl] ACL object received from the OBIEE web catalogue service containing all
		* permission definitions.
	*/
	obiee.BIPermission = function(acl) {
		/** Integer representing binary permission mask for user's access to the catalogue item. */
		this.PermMask = 0;

		/** Object of booleans describing all of the permissions for the catalogue item. */
		this.Perms = {
			read: false,
			traverse: false,
			write: false,
			delete: false,
			changePerms: false,
			changeOwner: false,
			runBIP: false,
			scheduleBIP: false,
			viewBIP: false
		};

		/** Converts permissions object to an integer mask. */
		this.updateMask = function() {
			this.PermMask = obiee.permObjToMask(this.Perms);
		}

		/**
			* Additively updates current permissions from a permission mask.
			* @param {number} [mask] Permissions mask for a given ACL token.
		*/
		this.updatePerms = function(mask) {
			var permObj = obiee.permMaskToObj(mask);

			// Additively apply permissions, ignoring 'No Access' for now
			for (prop in permObj) {
				if (!this.Perms[prop]) this.Perms[prop] = permObj[prop];
			}
		}

		/**
			* Creates an object from the complete ACL object.
			* @param {object} [acl] ACL object received from the OBIEE web catalogue service containing all
			* permission definitions.
		*/
		this.createFromACL = function(acl) {
			var permObj = this;
			if ($.isPlainObject(acl.accessControlTokens)) {
				acl.accessControlTokens = [acl.accessControlTokens];
			}

			appRoles = acl.accessControlTokens.filter(function(token) {
				if (token.account) {
					return token.account.accountType == '4';
				} else {
					return false;
				}
			});

			// Current user application roles
			var userRoles = obiee.BIVariables.Session.filter(function(v) {
				return v.Name == 'ROLES';
			})[0].Value;

			appRoles.forEach(function(appRole) {
				if ($.inArray(appRole.account.name, userRoles) > -1) {
					permObj.updatePerms(+appRole.permissionMask);
				}
			});

			user = acl.accessControlTokens.filter(function(token) {
				if (token.account) {
					return token.account.accountType == '0' && token.account.name == sessionStorage.obieeUser;
				} else {
					return false;
				}
			});

			if (user.length > 0) {
				permObj.updatePerms(+user[0].permissionMask);
			}

			this.updateMask();
		};

		this.createFromACL(acl);
	};

	/* ------ END OF BI CLASS OBJECTS ------ */

	/* ------ PAGE INITIALISATION ------ */

	/** Stores BI server and session variables on page load based on the user's session. */
	obiee.BIVariables = {};
	if (sessionStorage.obieeSessionId) {
		obiee.fetchVariables();
	}

	/* ------ END OF PAGE INITIALISATION ------ */

	return obiee;
}());
