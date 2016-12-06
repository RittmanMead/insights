 rmvpp = (function(rmvpp){
    var pluginName = "sunburst"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Sunburst';
    rmvpp.Plugins[pluginName].description = 'A multi-level pie chart that is useful for viewing hierarchical data.';
    rmvpp.Plugins[pluginName].icon = "sun-o";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
			targetProperty:"level",
			formLabel:"Level",
			multiple: true,
			type: 'dim',
			required: true,
            desc: 'Attribute columns representing each level in the hierarchical structure.'
		},
		{
			targetProperty:"measure",
			formLabel:"Measure",
			type: 'fact',
			required: true,
            conditionalFormat: true,
            desc: 'Single measure column, determining size of the radial sections.'
		}
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"size",
			label: "Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 300
			},
            desc: 'Size of the chart in pixels.'
		},
        {
			targetProperty:"legend",
			label: "Legend",
			inputType: "checkbox",
			inputOptions: {	defaultValue : true },
            desc: 'Size of the chart in pixels.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {
				"defaultValue": "Flat-UI"
			},
            desc: 'Colour palette to use for discrete series colours'
		}
    ];

    rmvpp.Plugins[pluginName].actions = [
        {
			'trigger' : 'sectionClick',
			'type' : 'click',
			'name' : 'Click - Section',
			'output' : ['level'],
			'description' : 'Click on a section of the chart to pass through the category name at that level.'
		},
        {
			'trigger' : 'sectionHover',
			'type' : 'mouseover',
			'name' : 'Hover - Section',
			'output' : ['level'],
			'description' : 'Hover over a section of the chart to pass through the category name at that level.'
		}
    ];

    rmvpp.Plugins[pluginName].reactions = [
        {
			id : 'highlightSection',
			name : 'Highlight Section',
			description : 'Highlights the section (and ancestors) for the parameter passed through.',
			type : 'private'
		},
 		{
 			id : 'filter',
 			name : 'Filter',
 			description : 'Accepts a column map and value and filters the report if the subject area matches.',
 			type : 'general'
 		}
    ];

    // Highlight sections of the chart based on the input values from the interaction
    rmvpp.Plugins[pluginName].highlightSection = function(output, container) {
        if (output.length > 0 ) {
            var config = output[0].config;
            var columnMap = output[0].columnMap;
            var levelNames = columnMap.level.map(function(l) { return l.Name; });
            var chart = d3.select(container);
            var paths = chart.selectAll('path.section');

            // Fade all the segments.
            chart.selectAll("path.section")
                .style("opacity", 0.3);

            output.forEach(function(out) {
                var depth = levelNames.indexOf(out.col.Name) + 1;
                paths.filter(function(d, i) {
                    return d.depth == depth && out.values.indexOf(d.name) > -1;
                })
                .style('opacity', function(d, i) {
                    // Then highlight only those that are an ancestor of the current segment.
                    var ancestors = getAncestors(d);

                    chart.selectAll("path")
                        .filter(function(node) { return (ancestors.indexOf(node) >= 0); })
                        .style("opacity", 1);
                });
            })
        }
	};

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {

        // Get colour function from unique array of all dimension attributes
        var uniqueDims = rmvpp.uniqueDims(data, columnMap);
        var colourNames = uniqueDims[columnMap.level[0].Name];
        var colour = rmvpp.colourScale(colourNames, config.colours);

        // Set width, height, radii
		var width = +config.size, height = +config.size;
		var radius = +config.size / 2;
        var totalSize = 0; // Updated later

        // Create chart container elements
        var chartContainer = d3.select(container)
			.append('div')
			.classed('sunburst-chart', true);

		// Create tooltip
		var selector = $(chartContainer[0]).toArray();
		var tooltip = new rmvpp.Tooltip(chartContainer[0][0]);

		// Render chart SVG
		var chart = chartContainer.append("svg")
			.attr("width", width)
			.attr("height", height)
			.append("g")
				.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        // Add legend
        if (config.legend) {
            var legend = new rmvpp.Legend(chart, colourNames, columnMap.level[0].Name, radius);
            legend.addColourKey(colourNames, colour);
            legend.repositionCircular();
        }

        // D3 Layout algorithm used for sunburst
        var partition = d3.layout.partition()
            .size([2 * Math.PI, radius * radius])
            .value(function(d) { return +d.measure; });

        // SVG arcs based on partitioned nodes
        var arc = d3.svg.arc()
            .startAngle(function(d) { return d.x; })
            .endAngle(function(d) { return d.x + d.dx; })
            .innerRadius(function(d) { return Math.sqrt(d.y); })
            .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });

        // Build hierarchy from the flat data structure
        var nodeTree = { name : 'root', children: []};

        // Searches a node tree for a name at a given depth and adds child nodes
        function addChildNode(nodeChildren, name, datum) {
            var nodeNames = nodeChildren.map(function(node) {
                return node.name;
            });

            // Find which node child contains the value
            var idx = nodeNames.indexOf(name);
            if (idx == -1) { // Insert new node if not found
                newIdx = nodeChildren.push({ 'name' : name, 'children' : [], 'datum': datum});
                return nodeChildren[newIdx-1];
            } else {
                return nodeChildren[idx];
            }
        }

        // Adds leaf node, which has a name and value but no children
        function addLeafNode(nodeChildren, name, value, datum) {
            var node = { 'name': name, 'measure': value , 'datum' : datum}
            nodeChildren.push(node);
        }

        // Transform flat data output structure into hierarchical parent-child JSON object
        data.forEach(function(datum) {
            var nodes = nodeTree;
            datum.level.forEach(function(level, i) {
                if (i < columnMap.level.length-1) {
                    if (level.value)
                        nodes = addChildNode(nodes.children, level.value, datum);
                } else { // Handle leaf node
                    addLeafNode(nodes.children, level.value, +datum.measure, datum);
                }
            });
        });

        // For efficiency, filter nodes to keep only those large enough to see.
        var nodes = partition.nodes(nodeTree)
            .filter(function(d) {
                return (d.dx > 0.005); // 0.005 radians = 0.29 degrees
        });

        var path = chart.data([nodeTree]).selectAll("path")
            .data(nodes)
            .enter().append("svg:path")
            .attr("display", function(d) { return d.depth ? null : "none"; })
            .attr("d", arc)
            .attr("fill-rule", "evenodd")
            .classed('section', true)
            .style("fill", function(d) {
                var sectionColour = '';

                // Get the first ancestor and colour the section using that
                var ancestors = getAncestors(d);
                if (ancestors.length > 0) {
                    var hex = colour(ancestors[0].name);
                    sectionColour = rmvpp.increaseBrightness(hex, (d.depth-1) * 10); // Get brighter as you go further out
                }

                condFormats.forEach(function(cf) {
                    if (cf.SourceID == 'measure') { // Measure rules on section total
                        if (cf.compare(d.value)) {
                            sectionColour = cf.Style.colour;
                        }
                    } else if (cf.sourceProperty() == 'level') { // Attribute rules
                        if (cf.sourceIndex() == d.depth -1) { // Check that it is the right level
                            if (cf.compare(d.name)) {
                                sectionColour = cf.Style.colour;
                            }
                        }
                    }
                });

                return sectionColour;
            })
            .style('stroke', '#FFFFFF')
            .style("opacity", 1)
            .on('mouseover', function(d, i) {
                // Render tooltip message
                var dim = columnMap.level[d.depth-1].Name;
                var pct = ((+d.value / +totalSize) * 100).toFixed(1);
                var info = dim + ': <b>' + d.name + '</b><br/>';
                info += columnMap.measure.Name + ': <b>' + columnMap.measure.format(+d.value) + '</b></br>';
                info += pct + '%';
                tooltip.displayHTML(info, d3.event);

                // Fade all the segments.
                chart.selectAll("path")
                    .style("opacity", 0.3);

                // Then highlight only those that are an ancestor of the current segment.
                var ancestors = getAncestors(d);

                chart.selectAll("path")
                    .filter(function(node) { return (ancestors.indexOf(node) >= 0); })
                    .style("opacity", 1);

                // Send mouseover event
                rmvpp.createTrigger(pluginName, stripColumnMap(d.depth), container, 'sectionHover', stripDatum(d.datum, d.depth));
            })
            .on('mouseleave', function(d, i) {
                tooltip.hide();

                // Embolden in the sections
                chart.selectAll("path")
                    .style("opacity", 1)
            })
            .on('click', function(d, i) {
                rmvpp.createTrigger(pluginName, stripColumnMap(d.depth), container, 'sectionClick', stripDatum(d.datum, d.depth));
            })

        totalSize = path.node().__data__.value;

        // Strip the datum of all the objects that are not applicable, based on the depth
        function stripDatum(datum, depth) {
            var newDatum = { 'level' : [] };
            for (var i=0; i < depth; i++) {
                var key = columnMap.level[i].Name;
                newDatum[key] = datum[key];
                newDatum.level.push(datum.level[i]);
            }
            return newDatum;
        }

        // Strip the columnMap of all the objects that are not applicable, based on the depth
        function stripColumnMap(depth) {
            var newColumnMap = { 'level' : [], 'measure' : columnMap.measure };
            for (var i=0; i < depth; i++) {
                newColumnMap.level.push(columnMap.level[i]);
            }
            return newColumnMap;
        }
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
        var path = [];
        var current = node;
        while (current.parent) {
            path.unshift(current);
            current = current.parent;
        }
        return path;
    }

    return rmvpp;

 }(rmvpp || {}))
