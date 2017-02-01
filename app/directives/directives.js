// Icon Button directive
app.directive('iconButton', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		template: '<i ng-class="\'fa fa-\' + icon"><md-tooltip>{{ label }}</md-tooltip></i>',
		scope: {
			colour: '=',
			icon: '=',
			fn: '=',
			lock: '=' // Keep the colour on mouse actions
		},
		link: function(scope, elem, attrs) {
			var origColour = $(elem).css('color') == 'rgb(0, 0, 0)' ? '' : $(elem).css('color');
			var tooltipColour = scope.colour ? scope.colour : origColour;
			elem.on('mouseover', function(e) {
				if (!scope.lock) {
					if (scope.colour)
						d3.select(elem[0]).transition().style('color', scope.colour);
					scope.label = attrs.name || '';
				}
			})
			.on('mouseout', function() {
				if (!scope.lock) {
					if (scope.colour)
						d3.select(elem[0]).transition().style('color', origColour);
				}
				if (attrs.name)
					Global.tooltip.hide();
			})
			.on('click', function() {
				if (scope.fn)
					scope.fn();
			});

			scope.$watch('lock', function(nVal, oVal) {
				if (nVal)
					d3.select(elem[0]).style('color', scope.colour);
				else if (typeof(scope.lock) != 'undefined')
					d3.select(elem[0]).style('color', origColour);
			});
		}
	}
}]);

// Template for a material input item, with custom CSS applied
app.directive('matInput', function() {
	return {
		restrict: 'E',
		templateUrl: '/insights/app/directives/templates/matInput.html',
		replace: true,
		scope: {
			value: '=',
			label: '@'
		}
	}
});

// Angular Material button directive with custom options that are used frequently throughout the app
app.directive('matButton', ['Global', function(Global) {
	return {
		restrict: 'E',
		templateUrl: '/insights/app/directives/templates/matButton.html',
		scope: {
			icon: "@"
		},
		link: function(scope, elem, attrs) {
			var type = attrs.type || 'primary';
			scope.labelPos = attrs.labelPos || 'right';
			scope.label = attrs.label;
			scope.icon = 'fa-' + scope.icon;
			scope.class = 'md-' + type;
			if (!attrs.hasOwnProperty('flat'))
				scope.class += ' md-fab';
			else
 				scope.class += ' md-icon-button';

			if (attrs.size)
				scope.class += ' md-' + attrs.size;

			scope.colour = attrs.colour || 'white';

			scope.margin = attrs.margin == 'none' ? { margin: 0 } : {};
			scope.size = attrs.size || 'big';
			switch(scope.size) {
				case 'mini-x': scope.fontSize = 14; break;
				case 'mini': scope.fontSize = 18; break;
				case 'big' : scope.fontSize = 26; break;
			}
		}
	}
}]);

// Buttons with text labels as well as icons
app.directive('button', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		template: '<div class="button"><i ng-class="\'fa fa-\' + icon"></i><span>{{ label }}</span></div>',
		scope: {
			colour: '=',
			icon: '=',
			label: '='
		},
		link: function(scope, elem, attrs) {
			var origColour = $(elem).css('color') == 'rgb(0, 0, 0)' ? '' : $(elem).css('color');
			elem.on('mouseover', function(e) {
				var colour = scope.colour.replace('rgba', 'rgb');
				d3.select(elem[0]).select('i').transition().style('color', colour);
			})
			.on('mouseout', function() {
				d3.select(elem[0]).select('i').transition().style('color', origColour);
			})
		}
	}
}]);

// Status message - temporary for success, permanent for failure
app.directive('statusMsg', ['UIConfig', '$timeout', function(UIConfig, $timeout) {
	return {
		restrict: 'A',
		scope: {
			statusMsg : '='
		},
		link: function(scope, elem, attrs) {
			scope.$watch(function () { return scope.statusMsg.status }, function (newVal, oldVal) {
				if (newVal == 'success') {
					$timeout(function() {
						$(elem).find('span').fadeOut(500, function() {
							scope.statusMsg.show = false;
							scope.statusMsg.msg = '';
							scope.$apply();
						});
					}, 500);
				}
			});
		},
		template: '<span class="statusMsg" ng-class="statusMsg.status">{{ statusMsg.msg }}</span>'
	}
}]);

// Font picker - select list with available fonts
app.directive('fontPicker', [function() {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			value : '=',
			change: '=' // Execute on value change
		},
		link: function(scope, elem, attrs) {
			// Master list of fonts
			scope.fonts = InsightsConfig.Fonts;

			// Check if font is installed
			var detective = new Detector();
			scope.fonts = scope.fonts.filter(function(f) {
				return detective.detect(f);
			});
		},
		templateUrl: '/insights/app/directives/templates/fontPicker.html'
	}
}]);

// Icon picker - select from configured Font Awesome icon
app.directive('iconPicker', ['Global', function(Global) {
	return {
		restrict: 'A',
		scope: {
			value : '=',
			label: '='
		},
		link: function(scope, elem, attrs) {
			scope.label = scope.label || 'Icon';
			scope.openPicker = function() {
				Global.iconPicker('', function(icon) {
					scope.value = icon;
				});
			}
		},
		templateUrl: '/insights/app/directives/templates/iconPicker.html'
	}
}]);

// Colour palette picker - select from configured palettes
app.directive('palettePicker', ['Global', function(Global) {
	return {
		restrict: 'A',
		scope: {
			value : '='
		},
		replace: true,
		link: function(scope, elem, attrs) {
			scope.palettes = InsightsConfig.Palettes;
			scope.current = function() {
				if ($.isArray(scope.value))
					return scope.value;
				else
					return InsightsConfig.Palettes[scope.value];
			};

			scope.openPicker = function() {
				Global.paletteEditor(scope.value, function(colours) {
					scope.value = colours;
				});
			}
		},
		templateUrl: '/insights/app/directives/templates/palettePicker.html'
	}
}]);

// Map code picker - shows dorpdown of possible features from a map file
app.directive('mapCode', ['Global', '$http', function(Global, $http) {
	return {
		restrict: 'A',
		scope: {
			label : '=',
			value: '=',
			map: '=',
			mapProperty: '='
		},
		replace: true,
		link: function(scope, elem, attrs) {
			scope.options = [];

			// Fetch property codes from the map object
			scope.getMapCodes = function() {
				if (scope.map) {
					return $http.get('/insights/topojson/' + scope.map).then(function(res){
						if ('objects' in res.data) {
							res.data = res.data.objects[Object.keys(res.data.objects)[0]].geometries[0];
							if ('properties' in res.data) {
								scope.options = Object.keys(res.data.properties);
							}
						}
					}, function(err) {
						scope.options = [];
					});
				}
			}
			scope.getMapCodes();
		},
		templateUrl: '/insights/app/directives/templates/mapCode.html'
	}
}]);

// Map feature picker - shows dropdown of possible TopoJSON features from a configured map files
app.directive('mapPicker', ['Global', function(Global) {
	return {
		restrict: 'A',
		scope: {
			label : '=',
			value: '='
		},
		replace: true,
		link: function(scope, elem, attrs) {
			scope.mapName = function() {
				var map = InsightsConfig.MapFeatures.filter(function(m) {
					return m.path == scope.value;
				});

				if (map.length > 0) {
					scope.name = map[0].name;
				} else {
					scope.name = 'Unknown';
				}
			}

			scope.openPicker = function() {
				Global.mapPicker(scope.value, scope.name, function(path, name) {
					scope.value = path;
					scope.name = name;
				});
			}

			scope.$watch('value', function() {
				scope.mapName();
			});
		},
		templateUrl: '/insights/app/directives/templates/mapPicker.html'
	}
}]);

// Map tile picker - shows dorpdown of possible features from a map file
app.directive('mapTilePicker', ['Global', function(Global) {
	return {
		restrict: 'A',
		scope: {
			label : '=',
			value: '='
		},
		replace: true,
		link: function(scope, elem, attrs) {
			scope.openPicker = function() {
				Global.mapTilePicker(scope.value, function(val) {
					scope.value = val;
				});
			}
		},
		templateUrl: '/insights/app/directives/templates/mapTilePicker.html'
	}
}]);

// Full screen loading animation
app.directive('loading', ['UIConfig', '$timeout', function(UIConfig, $timeout) {
	return {
		restrict: 'A',
		scope: {
			loading : '=',
			nickCage: '='
		},
		templateUrl: '/insights/app/directives/templates/loading.html'
	}
}]);

// Subject area directive (Pres tables and columns included)
app.directive('subjectArea', ['Global', 'Metadata', function(Global, Metadata) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			subjectArea: '=',
			subjectAreas: '=',
			metadata: '=',
			change: '='
		},
		templateUrl: '/insights/app/directives/templates/subjectArea.html',
		link: function(scope, element) { // Use link function to dynamically choose templates
			scope.presSearch = '';
			scope.loading = false;

			if (scope.subjectAreas.length == 0) {
				scope.loading = true;
				obiee.getSubjectAreas(function(results) {
					scope.subjectAreas = results.map(function(r) { return r.displayName; });
					Global.subjectAreas = scope.subjectAreas;
					scope.subjectArea = scope.subjectAreas[0];
					Metadata.popPresTables(scope.subjectArea, scope.metadata, function() {
						scope.loading = false;
						scope.$apply();
					});
				});
			}

			scope.changeSA = function() {
				scope.loading = true;
				Global.subjectArea = scope.subjectArea;
				Metadata.popPresTables(scope.subjectArea, scope.metadata, function() {
					scope.loading = false;
					if (scope.change)
						scope.change(true);
				});
			}
		}
	}
}])

// Subject area directive (Pres tables and columns included)
app.directive('presTable', function() {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/insights/app/directives/templates/presTable.html',
		link: function(scope, element) { // Use link function to dynamically choose templates
			scope.togglePresTable = function(table) {
				table.Show = !table.Show;
			}

			scope.hover = function(event) {
				$(event.target).prev().addClass('selected')
			}

			scope.hoverOut = function(elem) {
				$(event.target).prev().removeClass('selected')
			}

			scope.addFilter = function(col) {
				var filter = new obiee.BIFilter(col);
				scope.$emit('newFilter', filter);
			}
		}
	}
});

// Parameter Form directives
app.directive('columnMapContainer', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/insights/app/directives/templates/columnMapContainer.html',
		scope: {
			'columns': '=visColumns',
			'colmapParams': '=',
			'dropFns' : '=',
			'plugin': '='
		},
		link: function(scope, element, attrs) {
			scope.$watch('plugin', function() {
				scope.multipleDatasets = rmvpp.Plugins[scope.plugin].multipleDatasets;
			});
		}
	}
}]);

app.directive('columnMap', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/insights/app/directives/templates/columnMap.html',
		scope: {
			'columns': '=visColumns',
			'colmapParams': '=',
			'dropFns' : '=',
			'dataset': '='
		},
		link: function(scope, element, attrs) {
			scope.tooltip = function(desc, e) { Global.tooltip.displayHTML(desc, e); }
			scope.hideTooltip = function() { Global.tooltip.hide();	}

			scope.remove = function(column, subColumn, multiple) {
				if (!multiple) {
					scope.columns[column] = new obiee.BIColumn('', '');
				} else {
					$.removeFromArray(subColumn, column);
				};
			};

			scope.properties = function(col) {
				scope.$emit('editColumn', col);
			}

			scope.configuration = function(col, config) {
				scope.$emit('editColumnConfig', col, config);
			}

			scope.filter = function(col) {
				var filter = new obiee.BIFilter(col);
				scope.$emit('newFilter', filter, scope.dataset);
			}

			scope.edit = function() {
				if (scope.multiple) {
					if (scope.filter) {
						var filter = new obiee.BIFilter(scope.subColumn);
						scope.$emit('newFilter', filter);
					} else
						scope.$emit(scope.trigger, scope.subColumn, scope.config);
				} else {
					if (scope.filter) {
						var filter = new obiee.BIFilter(scope.column);
						scope.$emit('newFilter', filter);
					} else
						scope.$emit(scope.trigger, scope.column, scope.config);
				}
			}
		}
	}
}]);

// Config Form
app.directive('configForm', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/insights/app/directives/templates/config.html',
		scope: {
			'configVals': '=',
			'configParams': '='
		},
		link: function(scope, element, attrs) {
			scope.tooltip = function(desc, e) { Global.tooltip.displayHTML(desc, e); }
			scope.hideTooltip = function() { Global.tooltip.hide();	}
		}
	}
}]);

// Configuration Inputs
app.directive('configInput', function($timeout) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			configVals: '=',
			cp: '='
		},
		link: function(scope, element, attrs) { // Use link function to dynamically choose templates
			scope.template = function() {
				return '/insights/app/directives/templates/config/config-' + scope.cp.inputType + '.html';
			}
		},
		template: '<div ng-include="template()"></div>'
	}
});

// Conditional formatting
app.directive('conditionalFormats', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		templateUrl: '/insights/app/directives/templates/list/conditionalFormats.html',
		scope: {
			visColumns: '=',
			condFormats: '=',
			plugin: '='
		},
		link: function(scope, element, attrs) {
			scope.allowsCFs = function() {
				var hasCF = [];
				obiee.applyToColumnSets(rmvpp.Plugins[scope.plugin].columnMappingParameters, scope.plugin, function(item) {
					hasCF = hasCF.concat(item.filter(function(cm) {
						return cm.conditionalFormat;
					}));
					return item;
				});
				return hasCF.length > 0;
			}

			scope.opTranslate = function(op) {
				return obiee.operatorToText(op);
			}

			scope.targetName = function(cf) {
				var name = cf.TargetName;
				if (!name) {
					name = rmvpp.getColMapParams(scope.plugin, cf.Dataset).filter(function(cmp) {
						return cmp.targetProperty == cf.TargetID;
					})[0].formLabel;
					name = 'All ' + name;
				}
				return name;
			}

			scope.editCF = function(cf, idx) {
				Global.editCondFormat(cf, scope.visColumns, scope.plugin, function(out) {
					scope.condFormats[idx] = out;
				});
			}

			scope.newCF = function() {
				Global.editCondFormat(false, scope.visColumns, scope.plugin, function(out) {
					scope.condFormats.push(out);
				});
			}

			scope.removeCF = function(cf) {
				$.removeFromArray(cf, scope.condFormats);
			}
		}
	}
}]);

// Convert string to number if necessary
app.directive('stringToNumber', function() {
	return {
		require: 'ngModel',
		link: function(scope, element, attrs, ngModel) {
			ngModel.$parsers.push(function(value) {
				return '' + value;
			});
			ngModel.$formatters.push(function(value) {
				value = isNaN(parseFloat(value, 10)) ? value : parseFloat(value, 10);
				return value;
			});
		}
	};
});

app.directive('onKey', function() {
	return {
		restrict: 'A',
		link: function($scope, $element, $attrs) {
			$element.bind("keypress", function(event) {
				var keyCode = event.which || event.keyCode;
				var compareCode = +$attrs.code || 13; // Default as enter
				if (keyCode == +compareCode) {
					$scope.$apply(function() {
						$scope.$eval($attrs.onKey, {$event: event});
					});
				}
			});
		}
	};
});

// Designer toolkit
app.directive('designer', ['$window', '$timeout', 'UIConfig', 'Global', function($window, $timeout, UIConfig, Global) {
	return {
		restrict: 'A',
		scope: {
			biCanvas: '='
		},
		link: function(scope, elem, attrs) {
			var canvas = scope.biCanvas.Element; // Shorthand
			scope.shapeProperty = 'both', scope.font = 'Open Sans', scope.fontSize = 40;
			scope.textAlign = 'left';
			scope.bold = false, scope.underline = false, scope.italic = false;
			scope.mode = false; // Drawing variable, can accept 'line' currently

			var origX = 0, origY = 0;
			var heldShift = false;
			var heldCtrl = false;

			scope.colour = 'rgba(0,0,0,1)';
			scope.colourChange = function() {
				applyToGroup(function(obj) {
					if (obj.get('type') == 'i-text') {
						if (obj.getSelectedText()) {
							obj.setSelectionStyles({'fill' : scope.colour});
						} else
							obj.set('fill', scope.colour);
					} else {
						if (scope.shapeProperty == 'both') {
							obj.set('fill', scope.colour);
							obj.set('stroke', scope.colour);
						} else
							obj[scope.shapeProperty] = scope.colour;
					}

					canvas.renderAll();
				});
			};

			// Change font
			scope.fontChange = function() {
				$timeout(function() {
					applyStyleToText('fontFamily', scope.font);
				})
			}

			// Change font size
			scope.fontSizeChange = function() {
				applyStyleToText('fontSize', scope.fontSize);
			}

			// Font style
			scope.toggleBold = function() {
				applyStyleToText('fontWeight', (scope.bold ? 'bold' : 'normal'));
			}
			scope.toggleItalic = function() {
				applyStyleToText('fontStyle', (scope.italic ? 'italic' : 'normal'));
			}
			scope.toggleUnderline = function() {
				applyStyleToText('textDecoration', (scope.underline ? 'underline' : ''));
			}

			scope.textAlignChange = function() {
				applyStyleToText('textAlign', scope.textAlign);
			}

			// Copy to clipboard
			scope.copy = function() {
				if (canvas.getActiveObject())
					scope.clipboard = fabric.util.object.clone(canvas.getActiveObject());
			}

			// Paste to canvas
			scope.paste = function() {
				if (scope.clipboard) {
					scope.clipboard.set("top", scope.clipboard.top+5);
					scope.clipboard.set("left", scope.clipboard.left+5);
					canvas.add(scope.clipboard);
				}
			}

			// Catch key presses
			angular.element($window).on('keydown', function(e) {
				if (e.keyCode == 46) // Delete key
					scope.remove();

				if (e.keyCode == 16) // Shift key
					heldShift = true;

				if (e.keyCode == 17) // Control key
					heldCtrl = true;

				if (heldCtrl && e.keyCode == 67)
					scope.copy();

				if (heldCtrl && e.keyCode == 86)
					scope.paste();
			});

			angular.element($window).on('keyup', function(e) {
				if (e.keyCode == 16) // Shift key
					heldShift = false;

				if (e.keyCode == 17) // Control key
					heldCtrl = false;
			});

			function highlightButton(element) {
				var el = $(element);

				// Reset other buttons
				el.parents('.controls').find('button').css('background-color', 'rgb(3,155,229)');

				// Highlight button regardless of which element is clicked
				if ($(element).is('mat-button')) {
					el = el.children('button').first();
				} else if ($(element).is('md-icon')) {
					el = el.parent();
				}

				el.css('background-color', 'rgb(76,175,80)');
			}

			// Create a square on the canvas
			scope.drawSquare = function(event) {
				scope.mode = 'rect';
				canvas.selection = false;
				highlightButton(event.target);
			}

			// Create a circle on the canvas
			scope.drawCircle = function(event) {
				scope.mode = 'circle';
				canvas.selection = false;
				highlightButton(event.target);
			}

			// Add an image to the canvas based on a URL
			scope.addImage = function() {
				Global.imageDialogue(function(url) {
					fabric.Image.fromURL(url, function(oImg) {
						canvas.add(oImg);
					});
				});
			}

			// Create a textbox on the canvas
			scope.addText = function() {
				var textObj = new fabric.IText('Text', {
					fontFamily: scope.font,
					fill: scope.colour,
					fontSize: scope.fontSize,
					fontWeight: (scope.bold ? 'bold' : 'normal'),
					textDecoration: (scope.underline ? 'underline' : ''),
					fontStyle: (scope.italic ? 'italic' : 'normal'),
					textAlign: scope.textAlign,
					strokeWidth: 0,
					left: 25,
					top: 25
				});
				canvas.add(textObj);
			}

			// Create a line on the canvas
			scope.drawLine = function(event) {
				scope.mode = 'line';
				canvas.selection = false;
				highlightButton(event.target);
			}

			// Delete object from canvas
			scope.remove = function() {
				applyToGroup(function(obj) { canvas.remove(obj); });
				scope.biCanvas.deselectAll();
			}

			// Applies function to a group of selected objects if applicable
			function applyToGroup(func) {
				if (canvas.getActiveGroup()){
					canvas.getActiveGroup().forEachObject(function(obj){
						if (obj)
							func(obj)
					});
				} else {
					var obj = canvas.getActiveObject();
					if (obj)
						func(obj);
				}
			}

			// Applies style to font selection
			function applyStyleToText(prop, val) {
				applyToGroup(function(obj) {
					if (obj.get('type') == 'i-text') {
						if (obj.getSelectedText()) {
							var style = {};
							style[prop] = val;
							obj.setSelectionStyles(style);
						} else
							obj.set(prop, val);
						canvas.renderAll();
					}
				});
			}

			// Allows drawing of objects
			if (canvas) {
				canvas.on({ 'object:selected': selectedObject });

				var isDown, line, rect, circ;
				canvas.on('mouse:down', function(o){ // Drawing handler
					isDown = true;
					var pointer = canvas.getPointer(o.e);
					origX = pointer.x, origY = pointer.y;

					if (scope.mode == 'line') { // Initialise line
						var points = [ pointer.x, pointer.y, pointer.x, pointer.y ];
						line = new fabric.Line(points, {
							strokeWidth: 2,
							fill: scope.colour,
							stroke: scope.colour,
							originX: 'center',
							originY: 'center'
						});
						canvas.add(line);
					} else if (scope.mode == 'rect') { // Initiliase rectangle
						rect = new fabric.Rect({
							strokeWidth: 2,
							fill: scope.colour,
							stroke: scope.colour,
							width: 0,
							height: 0,
							left: origX,
							top: origY,
							originX: 'left',
							originY: 'top'
						});
						canvas.add(rect);
					} else if (scope.mode == 'circle') {
						circ = new fabric.Ellipse({
							left: origX,
							top: origY,
							fill: scope.colour,
							stroke: scope.colour,
							strokeWidth: 2,
							rx: 0,
							ry: 0
						});
						canvas.add(circ);
					}
				});

				canvas.on('mouse:move', function(o){
					if (!isDown) return;
					var pointer = canvas.getPointer(o.e);

					if (scope.mode == 'line') { // Draw line
						line.set({ x2: pointer.x, y2: pointer.y });
						line.setCoords();
						canvas.renderAll();
					} else if (scope.mode == 'rect') { // Draw rectangle
						if (origX>pointer.x) rect.set({ left: Math.abs(pointer.x) });
						if (origY>pointer.y) rect.set({ top: Math.abs(pointer.y) });
						if (!heldShift) {
							rect.set({ width: Math.abs(origX - pointer.x) });
							rect.set({ height: Math.abs(origY - pointer.y) });
						} else {
							var side = d3.max([Math.abs(origX - pointer.x), Math.abs(origY - pointer.y)]);
							rect.set({ width: side });
							rect.set({ height: side });
						}

						rect.setCoords();
						canvas.renderAll();
					} else if (scope.mode == 'circle') { // Draw rectangle
						if (origX>pointer.x) circ.set({ left: Math.abs(pointer.x) });
						if (origY>pointer.y) circ.set({ top: Math.abs(pointer.y) });
						if (!heldShift) {
							circ.set({ rx: Math.abs(origX - pointer.x)/2 });
							circ.set({ ry: Math.abs(origY - pointer.y)/2 });
						} else {
							var side = d3.max([Math.abs(origX - pointer.x), Math.abs(origY - pointer.y)])/2;
							circ.set({ rx: side });
							circ.set({ ry: side });
						}

						circ.setCoords();
						canvas.renderAll()
					}
				});

				// Reset on mouse up
				canvas.on('mouse:up', function(o){
					isDown = false;
					scope.mode = false;
					$(elem).find('.controls button').css('background-color', 'rgb(3,155,229)');
					canvas.selection = true;
					scope.biCanvas.refresh();
					scope.$apply();
				});
			}

			// // Run on selecting object
			function selectedObject(e) {
				var id = canvas.getObjects().indexOf(e.target);
			}
		},
		templateUrl: '/insights/app/directives/templates/designer.html'
	};
}]);

// Drag and Drop directives
app.directive('drag', function() {
	return {
		restrict: 'A',
		scope: {
			'move' : '=',
			'end' : '='
		},
		link: function(scope, elem, attrs) {
			var move = scope.move || 'basic';
			var end = scope.end || 'snapBack';

			// If a string, use the insights drag functions. Otherwise pass function
			move = typeof(move) == 'string' ? insights.drag[move] : move;
			end = typeof(end) == 'string' ? insights.drag[end] : end;

			// Intract JS moving interactions
			interact(elem[0]).draggable({
				onmove: move,
				onend: end
			}).styleCursor(false);;
		}
	};
});

app.directive('dragColumn', function() {
	return {
		restrict: 'A',
		scope: {
			'dragColumn' : '='
		},
		link: function(scope, elem, attrs) {
			// Attach BIColumn  object to the element
			$(elem).data('column', scope.dragColumn);

			// Intract JS moving interactions
			interact(elem[0]).draggable({
				onmove: insights.drag.basic,
				onend: insights.drag.snapBack
			}).styleCursor(false);
		}
	};
});

app.directive('resize', function() {
	return {
		restrict: 'A',
		scope: {
			preserveAspect : '=',
			edgeTop : '=', // Make edges draggable
			edgeBottom : '=',
			edgeRight : '=',
			edgeLeft : '=',
			translate : '=', // Set to automatically translate object on the screen
			callback: '='
		},
		link: function(scope, elem, attrs){
			var edges = [];
			if(scope.edgeTop) edges.push('n');
			if(scope.edgeBottom) edges.push('s');
			if(scope.edgeLeft) edges.push('w');
			if(scope.edgeRight) edges.push('e');

			$(elem).resizable({
				handles: edges.join(', '),
				resize: function( event, ui ) {
					console.log('here');
					scope.callback(event, ui)
				}
			});
		}
	};
});

// Reorder columns in column map
app.directive('dropReorderCol', function() {
	return {
		restrict: 'A',
		scope: {
			array: '=',
			colTarget: '=',
			phWidth: '='
		},
		link: function(scope, element, attrs) {
			var phWidth = +scope.phWidth || 270;
			var dropFunction = function(event) {
				$(event.target).parent().find('.temp').remove(); // Clear placeholder

				var srcCol = scope.array.filter(function(c) {
					return c.Name == $(event.relatedTarget).text();
				})[0];

				var srcPos = $.inArray(srcCol, scope.array);
				var targetPos = $.inArray(scope.colTarget, scope.array);

				// Move element in array
				scope.array = $.moveInArray(scope.array, srcPos, targetPos);
				scope.$apply();
			};

			var placeHolder = $('<li class="empty temp"></li>').css('height', '16px');
			placeHolder.width(phWidth);

			interact(element[0]).dropzone({
				accept: '.colvalue', // Only accept elements matching this CSS selector
				overlap: 'pointer', // Threshold to determine drop

				ondragenter: function(event) {
					var srcCol = scope.array.filter(function(c) {
						return c.Name == $(event.relatedTarget).text();
					})[0];

					if ($.inArray(srcCol, scope.array) > -1) {
						if (event.dragEvent.dy > 0) {
							placeHolder.insertAfter($(event.target));
						} else {
							placeHolder.insertBefore($(event.target));
						}
					}
				},
				ondragleave: function(event) {
					$(event.target).parent().find('.temp').remove();  // Clear placeholder
				},
				ondrop: dropFunction,
				ondropdeactivate: insights.drag.dropDisable
			});
		}
	};
});

// Add column on double click
app.directive('addColumn', function(Global) {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			element.dblclick(function() {
				scope.column.verify(function() {
					scope.$emit('addColumn', scope.column);
				});
			});
		}
	};
});

// Single column drop function
app.directive('dropColumn', ['Global', function(Global) {
	return {
		restrict: 'A',
		scope: {
			'column' : '=',
			'enableDrag': '=',
			'multiple' : '@'
		},
		link: function(scope, element, attrs) {
			var dropFunction;

			var addSingleCol = function(column) {
				scope.column = column;
				scope.$apply();
			}

			var addMultiCol = function(column) {
				if ($.inArray(column, scope.column) == -1) {
					scope.column.push(column);
					scope.$apply();
				}
			}

			var verifyCol = function(column, callback) {
				if (!column.Verified) {
					column.verify(function(info){
						$(element).data('column', column); // Attach BIColumn  object to the element
						callback(column);
					});
				} else {
					$(element).data('column', column); // Attach BIColumn  object to the element
					callback(column)
				}
			}

			var processColumn = function(event, callback) {
				var newCol = $(event.relatedTarget).data().column;
				if (newCol && newCol.Code) { // If column object attached
					var columnMap = scope.$parent.$parent.$parent.columns;
					obiee.removeFromColumnMap(columnMap, newCol);
					verifyCol(newCol, callback);
				} else if ($(event.relatedTarget).attr('code')) { // Otherwise get from global metadata
					var column = angular.copy(Global.biMetadata[Global.subjectArea].AllColumns[$(event.relatedTarget).attr('code')]);
					verifyCol(column, callback);
				};
			}

			var single = function(event) {
				processColumn(event, addSingleCol);
			};

			var multiple = function(event) {
				processColumn(event, addMultiCol);
			};

			dropFunction = scope.multiple ? multiple : single;

			interact(element[0]).dropzone({
				accept: '.dragColumn', // Only accept elements matching this CSS selector
				overlap: 'pointer', // Threshold to determine drop
				ondragenter: insights.drag.enter,
				ondragleave: insights.drag.leave,
				ondrop: dropFunction,
				ondropdeactivate: insights.drag.dropDisable
			});

			// Intract JS moving interactions
			if (scope.enableDrag) {
				// Attach BIColumn  object to the element
				$(element).data('column', scope.column);

				interact(element[0]).draggable({
					onmove: insights.drag.basic,
					onend: insights.drag.snapBack
				}).styleCursor(false);
			}
		}
	};
}]);

app.directive('dropVis', function() {
	return {
		restrict: 'A',
		scope: {
			'callback' : '='
		},
		link: function(scope, element, attrs) {
			var dropFunction = function(event) {
				var x = event.dragEvent.pageX - $(event.target).position().left;
				var y = event.dragEvent.pageY - $(event.target).position().top;
				var vis = $(event.relatedTarget).attr('data-vis-name');
				scope.callback(vis, x, y);
			};

			interact(element[0]).dropzone({
				accept: '.dragVis', // Only accept elements matching this CSS selector
				overlap: 'pointer', // Threshold to determine drop
				ondragenter: insights.drag.enter,
				ondragleave: insights.drag.leave,
				ondrop: dropFunction,
				ondropdeactivate: insights.drag.dropDisable
			});
		}
	};
});

// Remove column function
app.directive('removeColumn', ['UIConfig', function(UIConfig) {
	return {
		restrict: 'A',
		replace : true,
		scope: {
			'column' : '=',
			'subColumn' : '=',
			'multiple' : '@'
		},
		link: function(scope, element, attrs) {
			scope.remove = function() {
				if (!scope.multiple)
					scope.column = new obiee.BIColumn('', '');
				else {
					$.removeFromArray(scope.subColumn, scope.column);
				}
			};
		},
		template: '<span ng-show="column.Name || subColumn.Name"><i icon-button icon="\'times\'" name="Remove" ng-click="remove()" colour="negativeColour"></i></span>'
	};
}]);

// Remove column function
app.directive('editColumnBtn', ['UIConfig', function(UIConfig) {
	return {
		restrict: 'A',
		replace : true,
		scope: {
			'column' : '=',
			'subColumn' : '=',
			'multiple' : '@',
			'config' : '=', // Option for config button
			'filter': '=' // Option for filter button
		},
		link: function(scope, element, attrs) {
			scope.trigger = scope.config ? 'editColumnConfig' : 'editColumn';
			scope.icon = scope.config ? 'wrench' : 'cog';
			scope.btnName = scope.config ? 'Configuration' : 'Properties';

			if (scope.filter) {
				scope.icon = 'filter';
				scope.btnName = 'Filter';
			}

			scope.edit = function() {
				if (scope.multiple) {
					if (scope.filter) {
						var filter = new obiee.BIFilter(scope.subColumn);
						scope.$emit('newFilter', filter);
					} else
						scope.$emit(scope.trigger, scope.subColumn, scope.config);
				} else {
					if (scope.filter) {
						var filter = new obiee.BIFilter(scope.column);
						scope.$emit('newFilter', filter);
					} else
						scope.$emit(scope.trigger, scope.column, scope.config);
				}
			}
		},
		template: '<span ng-show="column.Name || subColumn.Name"><i icon-button icon="icon" fn="edit" colour="optionColour" name="{{ btnName }}"></i></span>'
	};
}]);

// Filter UI representation
app.directive('filtersContainer', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			'filters': '=filtersContainer',
			'plugin': '='
		},
		link: function(scope, element, attrs) {
			scope.$watch('plugin', function() {
				scope.multipleDatasets = rmvpp.Plugins[scope.plugin].multipleDatasets;
			});
		},
		templateUrl: '/insights/app/directives/templates/list/filtersContainer.html'
	};
}]);

app.directive('filters', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			'filters': '='
		},
		link: function(scope, element, attrs) {
			// Toggle whether filter is protected
			scope.toggleProtected = function(filter) {
				filter.Protected = !filter.Protected;
			}

			// Open advanced search modal
			scope.search = function(filter) {
				Global.advancedFilter(filter, true, function() {
					if (filter.ValueType == 'value' && filter.DataType == 'string') {
						scope.$broadcast('updateFilterPicklist', filter.Value);
					}
				});
			};

			scope.getFilterVal = function(filter) {
				if ($.isArray(filter.Value))
					return filter.Value[0];
				else
					return filter.Value;
			}

			// Remove filter from list
			scope.remove = function(filter) {
				$.removeFromArray(filter, scope.filters);
			};
		},
		templateUrl: '/insights/app/directives/templates/list/filters.html'
	};
}]);

// Add filter action
app.directive('addFilter', function() {
	return {
		restrict: 'A',
		scope: {
			'addFilter' : '=',
		},
		link: function(scope, element, attrs) {
			element.click(function() {
				var filter = new obiee.BIFilter(scope.addFilter);
				scope.$emit('newFilter', filter);
			});
		}
	};
});

// Remove filter action
app.directive('removeFilter', ['UIConfig', function(UIConfig) {
	return {
		restrict: 'A',
		scope: {
			'removeFilter' : '=',
			'allFilters' : '='
		},
		link: function(scope, element, attrs) {
			scope.remove = function() {
				scope.allFilters.splice($.inArray(scope.removeFilter, scope.allFilters),1);
				scope.$apply();
			};
		},
		template: '<i icon-button style="margin-right: 5px;" icon="\'times\'" fn="remove" colour="negativeColour"></i>'
	};
}]);

﻿// Configure and add new column
app.directive('editColumn', ['UIConfig', 'Global', function(UIConfig, Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			editMode : '=',
			column : '=',
			metadata : '=',
			inSubjectArea : '=',
			newMode : '='
		},
		link: function(scope, element, attrs) {
			scope.editType = 'Properties';
			if (scope.newMode)
				scope.column = new obiee.BIColumn('', '');
			else
				scope.origColumn = angular.copy(scope.column);

			scope.locales = Object.keys(rmvpp.locales);
			scope.error = '';

			// Cancel new column
			scope.cancelNewColumn = function() {
				scope.editMode = false;
				if (scope.newMode)
					scope.column.Code = '';
				else { // Reset column, assigning whole object not working
					scope.column.Code = scope.origColumn.Code;
					scope.column.Name = scope.origColumn.Name;
					scope.column.DataFormat = scope.origColumn.DataFormat;
				}

				scope.error = '';
			}

			// Add new column to metadata model
			scope.addNewColumn = function() {
				if (scope.newMode) {
					var newCol = new obiee.BIColumn(scope.column.Code, scope.column.Name, scope.column.DataType, 'Custom');
					newCol.DataFormat = scope.column.DataFormat;
					newCol.SubjectArea = scope.inSubjectArea;
					newCol.verify(function(columnInfo) { // Success
						if (newCol.Name) { // Check column has a name
							scope.error = '';
							newCol.HasSortKey = columnInfo.hasSortKey;
							newCol.Measure = columnInfo.aggRule;

							// If it's a measure set the default data type to a double
							if (newCol.Measure != 'none' && newCol.DataType == 'varchar') {
								newCol.DataType = 'double';
								newCol.DataFormat = newCol.getDefaultFormat();
							}

							if (newCol.DataFormat == '%s')
								newCol.DataFormat = newCol.getDefaultFormat();

							scope.metadata[scope.inSubjectArea].addColumn(newCol);
							scope.$emit('addColumn', newCol); // Add new column to the visualisation
							scope.column.Code = '';
							scope.editMode = false;
							scope.$apply();
						} else {
							scope.error = 'Column must be given a name.';
							scope.$apply();
						}
					}, function(err) { // Failure
						err = obiee.getErrorDetail(err);
						scope.error = err.basic;
						scope.$apply();
					});
				} else {
					scope.column.verify(function(columnInfo) {
						if (scope.column.Name) {
							scope.editMode = false;
							scope.$apply();
						} else {
							scope.error = 'Column must be given a name.';
							scope.$apply();
						}
					}, function(err) {
						err = obiee.getErrorDetail(err);
						scope.error = err.basic;
						scope.$apply();
					});
				}
			}

			scope.changeType = function() {
				scope.column.DataFormat = scope.column.getDefaultFormat();
			}

			scope.formatHelp = function() {
				var section;
				if (scope.column.DataType == 'varchar')
					section = 'string';
				else if ($.inArray(scope.column.DataType, ['double', 'integer']) > -1)
					section = 'number';
				else if (scope.column.DataType == 'date')
					section = 'date';

				window.open('/insights/docs/data-formats.html#' + section);
			}

			// Formula controls
			var textarea = element.find('textarea');
			interact(textarea[0]).dropzone({
				accept: '.dragColumn', // Only accept elements matching this CSS selector
				overlap: 'pointer', // Threshold to determine drop

				ondragenter: insights.drag.enter,
				ondragleave: insights.drag.leave,
				ondrop: function(event) {
					scope.column.Code += scope.metadata[scope.inSubjectArea].AllColumns[$(event.relatedTarget).attr('code')].Code;
					scope.$apply();
				},
				ondropdeactivate: insights.drag.dropDisable
			});

			scope.addRepVar = function() {
				if (scope.repVar)
					scope.column.Code += ' VALUEOF("' + scope.repVar + '")';
			}

			scope.addSessionVar = function() {
				if (scope.sessionVar)
					scope.column.Code += ' VALUEOF(NQ_SESSION."' + scope.sessionVar + '")';
			}

			scope.selectCode = function() {
				scope.selectedCode = $.getSelectedText();
			}

			scope.insertFunc = function() {
				Global.functionLibrary(function(func) {
					if (func && !$.isEmptyObject(func)) {
						if (scope.selectedCode) {
							func = func.Syntax.replace('expr', scope.selectedCode);
							scope.column.Code = scope.column.Code.replace(scope.selectedCode, func);
						} else
							scope.column.Code += ' ' + func.Syntax;
					}
				})
			}
		},
		templateUrl: '/insights/app/directives/templates/edit/editColumn.html'
	};
}]);

﻿// Configure and add new column
app.directive('columnConfig', ['UIConfig', function(UIConfig) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			column : '=',
			config: '=',
			plugin: '='
		},
		link: function(scope, element, attrs) {
			if (scope.column.Config.Plugin != scope.plugin)
				scope.column.Config = {};
			if ($.isEmptyObject(scope.column.Config))
				scope.column.Config = rmvpp.getDefaultColumnConfig(scope.config);
			scope.orig = angular.copy(scope.column.Config);

			// Cancel changes
			scope.cancel = function() {
				scope.column.Config = scope.orig;
				scope.config = false;
			}

			// Accept changes
			scope.accept = function() {
				scope.column.Config.Plugin = scope.plugin;
				scope.config = false;
			}
		},
		templateUrl: '/insights/app/directives/templates/edit/columnConfig.html'
	};
}]);

// Tabs
app.directive('tabset', function() {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			tabset: '=',
			selectedTab: '='
		},
		link: function(scope, element, attrs) {
			scope.changeTab = function(tab) {
				scope.selectedTab = tab;
			}
		},
		templateUrl: '/insights/app/directives/templates/tabset.html'
	}
});

// Visualisation selector menu
app.directive('visSelectors', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			visSelectors: '=',
			visuals: '='
		},
		link: function(scope, element, attrs) {
			scope.vis = function(vs) {
				return vs.Visuals
					.filter(function(c) { return c.enabled; })
					.map(function(c) { return c.name; })
					.join(', ');
			}

			// New selector
			scope.newSelector = function() {
				if (scope.visuals.length > 1) {
					var newVS = new obiee.BIVisualSelector();
					scope.visuals.forEach(function(vis) {
						newVS.Visuals.push({enabled: true, name: vis.Name, displayName: vis.DisplayName});
					});

					Global.editVisSelector(newVS, scope.visuals, function(vs) {
						scope.visSelectors.push(vs);
					});
				}
			};

			scope.editSelector = function(vs, idx) {
				Global.editVisSelector(vs, scope.visuals, function(vs) {
					scope.visSelectors[idx] = vs;
				});
			}

			scope.removeSelector = function(vs) {
				$.removeFromArray(vs, scope.visSelectors);
			}
		},
		templateUrl: '/insights/app/directives/templates/list/visSelectors.html'
	};
}]);

// Configure column selector menu
app.directive('colSelectors', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			colSelectors: '=',
			visuals: '='
		},
		link: function(scope, element, attrs) {
			scope.cols = function(cs) {
				return cs.Columns.map(function(c) { return c.Name; }).join(', ');
			}

			scope.vis = function(cs) {
				return cs.Visuals
					.filter(function(c) { return c.enabled; })
					.map(function(c) { return c.displayName; })
					.join(', ');
			}
//
			// New selector
			scope.newSelector = function() {
				if (scope.visuals.length > 0) {
					var newCS = new obiee.BIColumnSelector();
					Global.editColSelector(newCS, scope.visuals, function(cs) {
						scope.colSelectors.push(cs);
					});
				}
			};

			scope.editSelector = function(cs, idx) {
				Global.editColSelector(cs, scope.visuals, function(cs) {
					scope.colSelectors[idx] = cs;
				});
			}

			scope.removeSelector = function(cs) {
				$.removeFromArray(cs, scope.colSelectors);
			}
		},
		templateUrl: '/insights/app/directives/templates/list/colSelectors.html'
	};
}]);

// Configure drilldown menu
app.directive('drilldowns', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			drilldowns: '=',
			visuals: '=',
			dbPath: '=',
			editMode: '='
		},
		link: function(scope, element, attrs) {
			scope.newMode = false;

			// Create a new interaction
			scope.newDrill = function() {
				Global.editDrilldown(createDefaultInteraction(), scope.visuals, function(drill) {
					scope.drilldowns.push(resetDrill(drill));
				});
			}

			scope.editDrill = function(drill, idx) {
				drill.disable();
				Global.editDrilldown(drill, scope.visuals, function(out) {
					scope.drilldowns[idx] = resetDrill(out);
				}, function() {
					scope.drilldowns[idx] = resetDrill(drill);
				});
			}

			scope.removeDrill = function(drill) {
				drill.disable();
				$.removeFromArray(drill, scope.drilldowns);
			}

			function createDefaultInteraction() {
				var sourceVis = scope.visuals[0];
				var newDrill = new obiee.BIDrilldown(sourceVis);
				return newDrill;
			};

			// Description of the selected trigger
			scope.triggerName = function(int) {
				return rmvpp.Plugins[int.SourceVis.Plugin].actions.filter(function(a) { return a.trigger == int.Trigger; })[0].name;
			};

			// Reset (or add) drilldown interaction
			function resetDrill(drill) {
				if (drill) {
					drill.SourceVis.Container = $('.dbLayout .visualisation[vis-number="' + drill.SourceVis.ID + '"]')[0];
					var newInteract = new obiee.BIDrilldown(drill.SourceVis, drill.DrillPath, drill.Trigger, drill.Columns, scope.dbPath, [], drill.Handler);
					return newInteract;
				}
			}
		},
		templateUrl: '/insights/app/directives/templates/list/drilldowns.html'
	};
}]);

// Configure interactions
app.directive('interactions', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			interactions: '=',
			visuals: '=',
		},
		link: function(scope, element, attrs) {

			// Create a new interaction
			scope.newInt = function() {
				if (scope.visuals.length > 1) {
					Global.editInteraction(createDefaultInteraction(), scope.visuals, function(interact) {
						scope.interactions.push(resetInteraction(interact));
					});
				}
			}

			scope.editInt = function(int, idx) {
				int.disable();
				Global.editInteraction(int, scope.visuals, function(out) {
					scope.interactions[idx] = resetInteraction(out);
				}, function() { // Cancel
					scope.interactions[idx] = resetInteraction(int);
				});
			}

			// Description of the selected trigger
			scope.triggerName = function(int) {
				return rmvpp.Plugins[int.SourceVis.Plugin].actions.filter(function(a) { return a.trigger == int.Trigger; })[0].name;
			};

			// Description of the selected reaction
			scope.reactionName = function(int) {
				return rmvpp.Plugins[int.TargetVis.Plugin].reactions.filter(function(a) { return a.id == int.Action; })[0].name;
			}

			scope.removeInt = function(int) {
				int.disable();
				$.removeFromArray(int, scope.interactions);
			}

			function createDefaultInteraction() {
				var sourceVis = scope.visuals[0];
				var targetVis = scope.visuals[1];
				var newInteract = new obiee.BIInteraction(sourceVis, targetVis);
				return newInteract;
			}

			function resetInteraction(interact) {
				if (interact) {
					interact.SourceVis.Container = $('.dbLayout .visualisation[vis-number="' + interact.SourceVis.ID + '"]')[0];
					interact.TargetVis.Container = $('.dbLayout .visualisation[vis-number="' + interact.TargetVis.ID + '"]')[0];
					var newInteract = new obiee.BIInteraction(interact.SourceVis, interact.TargetVis, interact.Trigger, interact.Action, interact.Columns, interact.Handler);
					return newInteract;
				}
			}
		},
		templateUrl: '/insights/app/directives/templates/list/interactions.html'
	};
}]);

// Dashboard directive
app.directive('dashboardPage', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			'db': '=',
			'path': '=',
			'designMode': '=' // Indicates whether in canvas editing mode
		},
		link: function(scope, element, attrs) {
			scope.firstLoad = true;
			scope.db.Container = element[0];

			// Refreshes dashboard page, i.e. reloads it
			scope.$on('reloadDB', function(event, callback, errFunc) {
				loadDB(callback, errFunc);
			});

			function resetDB(dbObj) {
				scope.db = new obiee.BIDashboardPage(); // Reset dashboard
				scope.$apply();
				dbObj.Container = element[0];
				scope.firstLoad = true;
				scope.db = dbObj;
				scope.$broadcast('loadingDB'); // Tell others about dashboard loading
				scope.$apply();
			}

			function loadDB(callback, errFunc) {
				var path = scope.path || scope.db.Path;
				obiee.loadDB(path, function(dbObj) {
					resetDB(dbObj);
					if (callback)
						callback();
				}, errFunc);
			}

			// Refreshes dashboard UI from JS object
			scope.$on('refreshDB', function(event) {
				if (scope.db.Visuals.length > 0) {
					var dbObj = scope.db;
					resetDB(dbObj);
				} else {
					loadDB();
				}
			});

			// Drill to report
			scope.$on('drillToReport', function(event, path, crumbs, navBack) {
				if (!navBack) { // Don't append breadcrumbs if navigating back
					crumbs = scope.db.Breadcrumbs.concat(crumbs);
				}

				// Add special 'home' crumb to keep prompt values when returning to original page
				if (crumbs.length == 1) {
					if (crumbs[0].TargetPath != 'Home') {
						// Get prompted filters
						var filters = crumbs[0].DrillFilter.filter(function(df) {
							return df.global;
						});

						var homeCrumb = new obiee.BIBreadcrumb(crumbs[0].SourcePath, 'Home', filters);
						crumbs.unshift(homeCrumb);
					}
				}

				Global.loadingOn(false, false, false, false, scope);
				obiee.loadDB(path, function(dbObj) {
					Global.loadingOff();

					// Update prompts for special 'home' crumb
					if (crumbs.length == 1 && crumbs[0].TargetPath == 'Home') {
						insights.updatePrompt(crumbs[0].DrillFilter, dbObj.Prompts);
						crumbs = [];
					}

					dbObj.Breadcrumbs = crumbs;
					dbObj.Breadcrumbs.forEach(function(bc) {
						dbObj.Visuals.forEach(function(vis) {
							insights.updateFilters(bc.DrillFilter, vis, false);
						});
						insights.updatePrompt(bc.DrillFilter, dbObj.Prompts);
					});

					// Reset dashboard
					resetDB(dbObj);
				});
			});

			// Update dashboard on prompts
			scope.$on('applyPrompts', function(event) {
				applyPrompts();
			});

			// Executes when the prompts have finished loading
			scope.$on('promptsFinished', function(event) {
				applyPrompts();
				scope.firstLoad = false;
			});

			// Updates dashboard by swapping column
			scope.$on('applyColumnSelect', function(event, selector, newColID) {
				insights.applyColumnSelect(selector, scope.db.Visuals, newColID, scope);
			});

			// Refresh interactions (e.g. after dynamic filter)
			scope.$on('refreshInteractions', function(event, vis) {
				refreshInteractions(scope.db.Interactions, vis);
				refreshInteractions(scope.db.Drilldowns, vis);
			});

			// Updates relevant visualisations in the dashboard based on the prompt
			function applyPrompts(preventRender) {
				if (!$.isEmptyObject(scope.db.Prompts)) {
					var visArray = scope.db.Visuals;

					// Loop through visualisations and apply filters if applicable
					for (var i=0; i < visArray.length; i++) {
						var refreshVis = scope.db.Prompts.promptVisFilters(visArray[i]);


						// Execute views if filters have changed
						if (refreshVis) {
							if (obiee.showOrHideVis(scope.db.VisualSelectors, visArray[i])) {
								visArray[i].Refresh = 1; // Refresh query
								if (!preventRender)
									visArray[i].render(scope);
							} else {
								visArray[i].Refresh = 2; // Tell visual selector to refresh when next viewed
							}
						} else {
							visArray[i].Refresh = 0;
							if (obiee.showOrHideVis(scope.db.VisualSelectors, visArray[i])) {
								if (!preventRender) {
									visArray[i].render(scope);
								}
							}
						}
					};

					// Update drilldown breadcrumbs if manipulated by dashboard prompt
					scope.db.Breadcrumbs.forEach(function(bc) {
						scope.db.Prompts.Filters.forEach(function(filter) {
							var match = bc.DrillFilter.filter(function(d) { return d.col.Code == filter.Column.Code; })[0];
							if (match) {
								match.values = filter.Value;
							}
						});
					});
				}
			}

			// Refresh interactions (e.g. after dynamic filter)
			function refreshInteractions(intArray, vis) {
				if (intArray) {
					var visuals = intArray.map(function(i) { return i.SourceVis; });
					var findVis = $.inArray(vis, visuals);
					var indices = $.map(visuals, function(v, i) {
						if(v == vis)
							return i;
					});

					indices.forEach(function(i) {
						intArray[i].disable();
						intArray[i].enable(scope);
					});
				}
			}

			// Filter function for visualisations to dynamically hide in certain situations
			scope.hideVis = function(vis) {
				return obiee.showOrHideVis(scope.db.VisualSelectors, vis);
			}

		},
		templateUrl: '/insights/app/directives/templates/dashboardPage.html'
	};
}]);

// Dashboard Canvas
app.directive('dbCanvas', ['Global', '$timeout', function(Global, $timeout) {
	return {
		restrict: 'A',
		replace: false,
		link: function(scope, element, attrs) {
			function refreshCanvas() {
				$(element).empty().append('<canvas  class="designLayer"></canvas>');

				if (scope.db.Canvas) {
					if (scope.db.Canvas.JSON) {
						if (fabric.checkCanvasJSON(scope.db.Canvas.JSON)) {
							// Allows dashboard divs to be sized before creating the canvas
							$timeout(function() {
								scope.db.createCanvas();
							});
						}
					} else {
						$timeout(function() {
							scope.db.createCanvas();
						});
					}
				}
			}

			scope.$watch('db.Canvas.JSON', function() {
				refreshCanvas();
			});
		},
		template: '<canvas  class="designLayer"></canvas>'
	}
}]);

// Visualisation containers
app.directive('visualisation', ['Visuals', 'UIConfig', function(Visuals, UIConfig) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			scope.editMode = false;

			var render = function() {
				scope.vis.Container = $(element).children('.visualisation')[0];

				// Do not render if the visualisation is prompted by a dashboard level filter
				if (!obiee.isPrompted(scope.vis, scope.db.Prompts) || !scope.$parent.firstLoad) {
					scope.vis.render(scope);
				}
			}

			// Enable move on edit
			scope.$on('enableEdit', function() {
				Visuals.move(element, scope.vis);

				// Reload visualisation after resize and update configuration
				function resizeVis(event, ui) {
					if (scope.vis) {
						var widthRatio = (ui.size.width+1)/ui.originalSize.width;
						var heightRatio = (ui.size.height+1)/ui.originalSize.height;

						// Correction for unintended shrinking on resize
						$(event.target).height($(event.target).height()+1);
						$(event.target).width($(event.target).width()+1);

						var resized = false;
						for (param in scope.vis.Config) {
							if (param == 'size') {
								if (widthRatio != 1) {
									scope.vis.Config.size = Math.round(scope.vis.Config.size * widthRatio);
									resized = true;
								}
							} else if (param == 'width') {
								if (widthRatio != 1) {
									scope.vis.Config.width = Math.round(scope.vis.Config.width * widthRatio);
									resized = true;
								}
							} else if (param == 'height') {
								if (heightRatio != 1) {
									scope.vis.Config.height = Math.round(scope.vis.Config.height * heightRatio);
									resized = true;
								}
							}
						}

						if (resized) {
							// Scale configuration parameters
							var scaleProps = rmvpp.Plugins[scope.vis.Plugin].configurationParameters.filter(function(cp) {
								return 'scalable' in cp;
							});
							scaleProps.forEach(function(cp) {
								switch(cp.scalable) {
									case 'size':
										if (widthRatio != 1) {
											scope.vis.Config[cp.targetProperty] = Math.round(scope.vis.Config[cp.targetProperty] * widthRatio);
										}
										break;
									case 'width':
										if (widthRatio != 1) {
											var newVal =
											scope.vis.Config[cp.targetProperty] = Math.round(scope.vis.Config[cp.targetProperty] * widthRatio);
										}
										break;
									case 'height':
										if (heightRatio != 1) {
											scope.vis.Config[cp.targetProperty] = Math.round(scope.vis.Config[cp.targetProperty] * heightRatio);
										}
										break;
								}
							});

							$(element.find('.visualisation')[0]).resizable( "destroy" );
							scope.vis.render(scope, function() { enableResize(); });
						}

						// var preserveRatio = scope.vis.Config.size ? true : false;
						// if (preserveRatio) {
						// 	if (widthRatio != 1) {
						// 		$(element.find('.visualisation')[0]).resizable( "destroy" );
						// 		scope.vis.Config.size = Math.round(scope.vis.Config.size * widthRatio);
						// 		scope.vis.render(scope, function() { enableResize(); });
						// 	}
						// } else {
						// 	if (widthRatio != 1 || heightRatio != 1) {
						// 		$(element.find('.visualisation')[0]).resizable( "destroy" );
						// 		scope.vis.Config.width = Math.round(scope.vis.Config.width * widthRatio);
						// 		scope.vis.Config.height = Math.round(scope.vis.Config.height * heightRatio);
						// 		scope.vis.render(scope, function() { enableResize(); });
						// 	}
						// }
					}
				}

				function enableResize() {
					var preserveRatio = scope.vis.Config.size ? true : false;
					$(element.find('.visualisation')[0]).resizable({
						helper: "resizable-helper",
						stop: resizeVis,
						aspectRatio: preserveRatio
					}).append('<i class="fa fa-expand fa-flip-horizontal ui-resizable-se ui-resizable-handle"></i>');
				}

				enableResize();
				scope.editMode = true;
			});

			scope.removeVis = function() {
				$.removeFromArray(scope.vis, scope.db.Visuals);
			}

			// Disable move and update co-ordinates
			scope.$on('disableEdit', function() {
				Visuals.disableMove(scope.vis, element);
				if ($(element.find('.visualisation')[0]).resizable( "instance" ))
					$(element.find('.visualisation')[0]).resizable("destroy");
				scope.editMode = false;
			});

			obiee.applyToColumnSets(scope.vis.Query, scope.vis.Plugin, function(query) {
				obiee.removePromptedFilters(query.Filters);
				return query;
			});
			render();
		},
		templateUrl: '/insights/app/directives/templates/dashboard/visualisation.html'
	};
}]);

// Interaction directive
app.directive('interaction',['$timeout', function($timeout) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			// Arbitrary wait to ensure visual divs are loaded first
			$timeout(function() {
				scope.interaction.disable();
				scope.interaction.enable(scope);
			}, 500);
		},
		template: '<span display="none"></span>'
	}
}]);

// Drilldown directive
app.directive('drilldown', ['$timeout', function($timeout) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			// Arbitrary wait to ensure visual divs are loaded first
			$timeout(function() {
				scope.drilldown.disable();
				scope.drilldown.enable(scope);
			}, 500);
		},
		template: '<span display="none"></span>'
	}
}]);

// Column Selector
app.directive('columnSelector', ['Visuals', 'UIConfig', function(Visuals, UIConfig) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			scope.selectedCol = scope.cs.Columns[0].ID; // Default to first column

			// Apply column selector on change
			scope.applySelect = function(selectedCol) {
				scope.$emit('applyColumnSelect', scope.cs, selectedCol);
			}

			// Remove column selector from dashboard page
			scope.removeCS = function() {
				$.removeFromArray(scope.cs, scope.$parent.db.ColumnSelectors);
			}

			// Enable move on edit
			scope.$on('enableEdit', function() {
				Visuals.move(element);
				scope.editMode = true;
			});

			// Disable move and update co-ordinates
			scope.$on('disableEdit', function() {
				Visuals.disableMove(scope.cs, element);
				scope.editMode = false;
			});
		},
		templateUrl: '/insights/app/directives/templates/dashboard/columnSelector.html'
	};
}]);

// Visual Selector
app.directive('visualSelector', ['Visuals', 'UIConfig', '$timeout', function(Visuals, UIConfig, $timeout) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			scope.vs.Selected = scope.vs.Default;

			// Remove visual selector from dashboard page
			scope.removeVS = function() {
				$.removeFromArray(scope.vs, scope.$parent.db.VisualSelectors);
			}

			scope.changeVis = function() {
				var vis = Visuals.getVisByName(scope.vs.Selected, scope.$parent.db.Visuals)
				scope.$emit('applyPrompts', [vis]);
			}

			// Enable move on edit
			scope.$on('enableEdit', function() {
				Visuals.move(element);
				scope.editMode = true;
			});

			// Disable move and update co-ordinates
			scope.$on('disableEdit', function() {
				Visuals.disableMove(scope.vs, element);
				scope.editMode = false;
			});
		},
		templateUrl: '/insights/app/directives/templates/dashboard/visualSelector.html'
	};
}]);

// Prompt directive
app.directive('prompt', ['Visuals', 'UIConfig', '$q', function(Visuals, UIConfig, $q) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			scope.editMode = false;

			// Apply filters on pressing the filter button
			scope.go = function() {
				scope.$emit('applyPrompts');
			};

			// Enable move on edit
			scope.$on('enableEdit', function() {
				Visuals.move(element);
				scope.editMode = true;
			});

			// Disable move and update co-ordinates
			scope.$on('disableEdit', function() {
				Visuals.disableMove(scope.db.Prompts, element);
				scope.editMode = false;
			});

			// Resolve a promise when a filter loads
			scope.$on('filterLoaded', function(event, index) {
				if (index < dfdArray.length)
					dfdArray[index].resolve();
			});

			// Promise array to wait for all filters to populate before rendering
			var dfdArray = [], promises = [];
			scope.db.Prompts.Filters.forEach(function(f) {
				var defer = $q.defer();
				dfdArray.push(defer);
				promises.push(defer.promise);
			});

			// Wait for all filters to load before executing dashboard
			$q.all(promises).then(function() {
				scope.$emit('promptsFinished');
			});
		},
		templateUrl: '/insights/app/directives/templates/dashboard/prompt.html'
	}
}]);

// Breadcrumb directive
app.directive('breadcrumb', function() {
	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			// Filter breadcrumbs
			scope.remainingBCs = scope.$parent.db.Breadcrumbs.filter(function(d, i) { return i < scope.$index });

			// Drill back to the previous location
			scope.drillBack = function() {
				scope.$emit('drillToReport', scope.bc.SourcePath, scope.remainingBCs, true);
			}

			// Get file name rather than full path
			scope.stripPath = function(path) {
				return $.fileFromPath(path);
			}
		},
		template: '<span style="position: relative;" ng-if="$index > 0"><i ng-if="$index > 1" class="fa fa-chevron-right"></i><span class="breadcrumb" ng-click="drillBack()">{{ stripPath(bc.SourcePath) }}</span><span>'
	};
});

// Repository variable dropdowns
app.directive('repVars', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			val: "="
		},
		link: function(scope, element, attrs) {
			if ($.isArray(scope.val))
				scope.val = scope.val[0];

			scope.repVars = obiee.BIVariables.Repository;
			scope.repVarNames = obiee.BIVariables.Repository.map(function(v) { return v.Name });

			scope.getVarVal = function() {
				var findVal = obiee.BIVariables.Repository.filter(function(v) { return v.Name == scope.val; })
				if (findVal.length > 0) {
					return findVal[0].Value;
				} else
					return '';
			}
		},
		templateUrl: '/insights/app/directives/templates/vars/repVars.html'
	};
}]);

// Session variable dropdowns
app.directive('sessionVars', ['Global', function(Global) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			val: "="
		},
		link: function(scope, element, attrs) {
			if ($.isArray(scope.val))
				scope.val = scope.val[0];

			scope.sessionVars = obiee.BIVariables.Session;
			scope.sessionVarNames = obiee.BIVariables.Session.map(function(v) { return v.Name });

			scope.getVarVal = function() {
				var findVal = obiee.BIVariables.Session.filter(function(v) { return v.Name == scope.val; })
				if (findVal.length > 0) {
					return findVal[0].Value.join(', ');
				} else
					return '';
			}
		},
		templateUrl: '/insights/app/directives/templates//vars/sessionVars.html'
	};
}]);

// Prompt filter directive
app.directive('promptFilter', ['UIConfig', 'ModalService', 'Global', function(UIConfig, ModalService, Global) {
	return {
		restrict: 'A',
		replace: true,
		link: function(scope, element, attrs) {
			scope.editFilter = false;

			// Update filter values when model changes
			scope.update = function(oldValue) {
				var equal = false;

				// Differing equality for arrays and strings
				if (typeof(oldValue) == 'string' || typeof(oldValue) == 'undefined') {
					equal = oldValue == scope.filter.Value;
				} else {
					equal = oldValue.equals(scope.filter.Value);
				}

				if (scope.filter.PromptOptions.GoLess && !equal) {
					scope.$emit('applyPrompts');
				}
			}

			// Function to run on load telling parent that the filter has loaded asynchronously
			scope.load = function() {
				scope.$emit('filterLoaded', scope.$index);
			}

			// Enable move on edit
			scope.$on('enableEdit', function() {
				scope.editFilter = true;
			});

			// Remove filter from prompt
			scope.removeFilter = function() {
				$.removeFromArray(scope.filter, scope.db.Prompts.Filters);
			}

			// Open edit modal for the filter
			scope.editPromptFilter = function() {
				var origSQL = angular.copy(scope.filter.PromptOptions.SQLOverride);
				Global.editPromptFilter(scope.filter, function(filter) {
					scope.filter.PromptOptions = filter.PromptOptions;
					updateChoices(origSQL);
				});
			}

            // Functions for checkbox selection
            scope.toggle = function(choice) {
				if (typeof(scope.filter.Value) == 'string') {
					scope.filter.Value = [scope.filter.Value];
				}

                if (scope.exists(choice)) {
                    $.removeFromArray(choice, scope.filter.Value);
                } else {
                    scope.filter.Value.push(choice);
                }
                scope.update();
            }

            scope.exists = function(choice) {
                if ($.inArray(choice, scope.filter.Value) == -1) {
                    return false;
                } else {
                    return true;
                }
            }

			// Disable move and update co-ordinates
			scope.$on('disableEdit', function() {
				scope.editFilter = false;
			});

			// Advanced search on filter
			scope.search = function() {
				Global.advancedFilter(scope.filter, false, function() {
					if (scope.filter.ValueType == 'value') {
						scope.$broadcast('updateFilterPicklist', scope.filter.Value);
						if (scope.filter.PromptOptions.GoLess)
							scope.$emit('applyPrompts');
					}
				});
			}

			// Updates the choices available to the user
			function updateChoices(origSQL) {
				if (scope.filter.PromptOptions.Style == 'picklist') {
					scope.$broadcast('updatePromptPicklistChoices', origSQL); // origSQL enables skipping of LSQL execution if unnecessary
				} else if ($.inArray(scope.filter.PromptOptions.Style, ['radio', 'checkboxes']) > -1) {
					if (scope.filter.PromptOptions.ChoiceType == 'lsql' && origSQL != scope.filter.PromptOptions.SQLOverride) {
						insights.lsqlFilterChoices(scope.filter, function(choices) {
							scope.filter.PromptOptions.SubOptions.choices = choices;
						});
					};
				}
			}

			// If it's a date or a measure, reset the value and use the defaults
			if (scope.filter.DataType == 'date' || scope.filter.Column.Measure != 'none') {
				var dfdArray = [];
				scope.filter.Value = '';
				insights.defaultPromptValues(scope.filter, scope.filter.Value, dfdArray, function(choices, val) {
					if (scope.filter.DataType == 'date') {
						val = val ? new Date(val) : null;
                    } else if (scope.filter.Column.Measure != 'none') {
                        val = +val;
                    }
					scope.filter.Value = val;
				});

				$.when.apply(null, dfdArray).done(function() {
					scope.load();
				});
			} else {
				var dfdArray = [];

				if ($.inArray(scope.filter.PromptOptions.Style, ['radio', 'checkboxes']) > -1) {
					updateChoices();
				}

				// Populates values with the defaults, including executing LSQL if necessary
				function loadDefaults() {
					scope.filter.Value = [];
					insights.defaultPromptValues(scope.filter, scope.filter.Value, dfdArray, function(choices, val) {
						scope.filter.Value.push(val);
					});

					$.when.apply(null, dfdArray).done(function() {
						if (scope.filter.PromptOptions.Style == 'radio' && scope.filter.Value.length > 0) {
							scope.filter.Value = scope.filter.Value[0]
						}

						scope.$broadcast('refreshPicklistSelection');
						scope.load();
					});
				}

				loadDefaults();
			}
		},
		templateUrl: '/insights/app/directives/templates/promptFilter.html'
	}
}]);

// Filter picklist directive
app.directive('filterPicklist', ['$q', '$timeout', function($q, $timeout) {
	return {
		restrict: 'A',
		replace: true,
		scope: {
			filter : '=',
			load: '=',
			change: '='
		},
		link: function(scope, element, attrs) {
			scope.init = false;
			scope.filterChoices = [];
			scope.loadChoices = function() {
				var deferred = $q.defer();
				if (!scope.init) { // Cache results
					scope.filterChoices = [];
					insights.getFilterChoices(scope.filter, scope.filterChoices, function() {
						scope.init = true;
						deferred.resolve();
					});
				} else
					deferred.resolve();

				return deferred.promise;
			}

			scope.getSelectedText = function() {
				var text = '';
				if (scope.filter.Value && $.isArray(scope.filter.Value)) {
					if (scope.filter.Value.length == 1)
						text = scope.filter.Value[0];
					else if (scope.filter.Value.length == 0) {
						text = '';
					} else {
						text = scope.filter.Value.length + ' Selected';
					}
				} else {
					text = '';
				}

				return text;
			}

			scope.stopProp = function(event) {
				event.stopPropagation();
			}

			// Update selected values from array
			scope.$on('updateFilterPicklist', function(event, newVals) {
				insights.mergeValsChoices(scope.filterChoices, newVals);
			});

			scope.$on('updatePromptPicklistChoices', function(event) {
				scope.filterChoices = [];
				if (scope.filter.PromptOptions.ChoiceType == 'lsql' && scope.filter.PromptOptions.SQLOverride) {
					insights.getFilterChoices(scope.filter, scope.filterChoices);
				} else {
					staticChoices();
				}
			});

			scope.$on('refreshPicklistSelection', function(event) {
				if (!scope.init) {
					scope.filter.Value.forEach(function(val) {
						scope.filterChoices.push({name: val, selected: true});
					});
				}
			});

			function staticChoices() {
				scope.filterChoices = [];
				scope.filter.PromptOptions.SubOptions.choices.forEach(function(choice) {
					scope.filterChoices.push({name: choice, selected: false});
				});
			}

			if (scope.filter.PromptOptions.ChoiceType == 'values') {
				staticChoices();
				scope.init = true;
			}
		},
		templateUrl: '/insights/app/directives/templates/filterPicklist.html'
	}
}]);

// Move element (margin-left) with side to side scrolling
app.directive('mainPanel', function($compile) {
	return {
		restrict: 'A',
		link: function (scope, elem, attrs) {
			elem.addClass('mainPanel');

			// Adjust margin in accordance with window scrolling
			var windowEl = $(window)
			var handler = function() {
				$(elem).css('margin-left', windowEl.scrollLeft());
			}
			windowEl.on('scroll', scope.$apply.bind(scope, handler));
        }
	};
});

app.directive('onErrorSrc', function() {
    return {
        link: function(scope, element, attrs) {
			element.bind('error', function() {
				if (attrs.src != attrs.onErrorSrc) {
					attrs.$set('src', attrs.onErrorSrc);
				}
			});
        }
    }
});
