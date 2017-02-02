 rmvpp = (function(rmvpp){

    var pluginName = "sankey"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Sankey Chart";
    rmvpp.Plugins[pluginName].description = 'Plots a [Sankey diagram](https://en.wikipedia.org/wiki/Sankey_diagram) which is a specific type of flow diagram where the width of the arrows are shown proportionally to the flow quantity. With OBIEE, this is particularly useful to show hierarchical information. A single query will be executed, with the parent levels aggregated in Javascript. Can hover over flows for tooltip information.';
	rmvpp.Plugins[pluginName].icon = "area-chart";

	rmvpp.Plugins[pluginName].columnMappingParameters = [
    	{
			targetProperty:"level",
			formLabel:"Level",
			multiple: true,
			type: 'dim',
			required: true,
            desc: 'Attribute columns representing each level in the data flow.'
		},
		{
			targetProperty:"measure",
			formLabel:"Measure",
			type: 'fact',
			required: true,
            desc: 'Single measure column, determining widths of the flow.'
		}
	];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"width",
            label: "Width",
            inputType: "textbox",
            inputOptions: {
				subtype : "number",
                "defaultValue": 600
            },
            desc: 'Width of the canvas in pixels.'
        },
        {
            targetProperty:"height",
            label: "Height",
            inputType: "textbox",
            inputOptions: {
				subtype : "number",
                "defaultValue": 300
            },
            desc: 'Height of the canvas in pixels.'
        },
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: {
				"defaultValue": "Flat-UI"
			},
            desc: 'Colour palette for the colours of the Sankey chart.'
		}
    ]

    rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'nodeHover',
			'type' : 'mouseover',
			'name' : 'Hover - Node',
			'output' : ['level'],
			'description' : 'Hover over a node inbetween links to trigger a data driven event.'
		},
        {
			'trigger' : 'nodeClick',
			'type' : 'click',
			'name' : 'Click - Node',
			'output' : ['level'],
			'description' : 'Click on a node inbetween links to trigger a data driven event.'
		}
	];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		}
	];

	rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container)   {
        var sankeyData = {"nodes" : [], "links" : []};
        if (!columnMap.measure.Code)
            rmvpp.displayError(container, 'No measure column specified.');

        // Rebase data elements so that the levels match the format required for the Sankey partitioning
        data.forEach(function(d) {
            columnMap.level.forEach(function(l, i) {
                if(i < (columnMap.level.length-1)) {
                    if (d.level[i].value ==  d.level[i+1].value) {
                        var newVal = d.level[i+1].value + ' (' + d.level[i+1].name + ')';
                        d[columnMap.level[i+1].Name] = newVal;
                        d.level[i+1].value = newVal;
                    }
                }
            });
        });

        var datasets = [];
        for (var i=0; i < columnMap.level.length-1; i++) { // Aggregate datasets using d3.nest
            datasets.push(rmvpp.aggregateData(data, [columnMap.level[i].Name, columnMap.level[i+1].Name], 'measure', columnMap.measure));
        }

        // Build up Sankey node group structure
        var nodeGroups = [];
        datasets.forEach(function(ds, i) {
            var nodeNames = [];
            ds.forEach(function(sourceDatum) {
                sankeyData.nodes.push({
                    "name": sourceDatum.key,
                    "column" : i
                }); // Source node
                nodeNames.push(sourceDatum.key);
                sourceDatum.values.forEach(function(targetDatum) {
                    sankeyData.nodes.push({
                        "name": targetDatum.key,
                        "level": i,
                        "column" : i+1
                    });
                    sankeyData.links.push({
                        "source": sourceDatum.key,
                        "target": targetDatum.key,
                        "value": targetDatum.values,
                        "level": i
                    });
                    nodeNames.push(targetDatum.key);
                });
            });
            nodeGroups.push(nodeNames);
        });


        // Return only the distinct / unique nodes
        var nodeKeys = d3.keys(d3.nest()
            .key(function (d) { return d.name; })
            .map(sankeyData.nodes));

        // Loop through each link replacing the text with its index from node
        sankeyData.links.forEach(function (d, i) {
            sankeyData.links[i].source = nodeKeys.indexOf(sankeyData.links[i].source);
            sankeyData.links[i].target = nodeKeys.indexOf(sankeyData.links[i].target);
        });

        // Finds a column object from a node name
        function getDatum(allNodes, nodeName) {
            var col;
            for (var i=0; i < allNodes.length; i++) {
                col = allNodes[i].column;
                if (nodeName == allNodes[i].name) { break; }
            }

            // Build arbitrary data object to compensate for the granularity change
            var datum =  { level: [] };
            for (var j=0; j < columnMap.level.length; j++) {
                datum.level.push({ value : undefined});
            }

            datum.level[col] = { value : nodeName };
            return datum;
        }

        // Now loop through each nodes to make nodes an array of objects
        // rather than an array of strings
        sankeyData.nodes = nodeKeys.map(function (d, i) {
            return { "name": d, "datum" : getDatum(sankeyData.nodes, d) };
        });

        // Render Visual
        var margin = {top: 0, bottom: 5,
                right: 15 + rmvpp.longestString(data.map(function(d) { return d.level[d.level.length-1].value; }), columnMap.level[columnMap.level.length-1].value, 11),
                left: 15 + rmvpp.longestString(data.map(function(d) { return  d.level[0].value; }), columnMap.level[0].value, 11)
            },
            width  = config.width - margin.left - margin.right,
            height = config.height - margin.top - margin.bottom;

        var colour = rmvpp.colourScale(data.map(function(d) { return d.level[0].value; }), config.colours); // Set colour scale

        var sankeyContainer = d3.select(container)
            .append('div')
            .attr('class', 'sankey-chart');

        var svg = sankeyContainer.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(15)
            .size([width,height]);

        var path = sankey.link();

        sankey
            .nodes(sankeyData.nodes)
            .links(sankeyData.links)
            .layout(2);

        // Draw links
        var tooltip = new rmvpp.Tooltip($(container).find('.sankey-chart')[0]);
        var link = svg.append("g").selectAll(".link")
            .data(sankeyData.links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", path)
            .style('stroke', function(d) {
                d.color = colour(d.source.name);
                return d.color;
            })
            .style({
                "stroke-width" : function(d) {
                    return Math.max(1, d.dy);
                },
                cursor: 'pointer',
                fill: 'none',
                'stroke-opacity': .3
            })
            .on('mouseover', function(d) {
                d3.select(this).transition().duration(200).style({
                    'stroke-opacity': .75,
                    'z-index': 1000
                })

                // Objects for tooltip
                var datum = {
                    source: d.source.name,
                    target: d.target.name,
                    measure: d.value
                };

                var cm = {
                    source: columnMap.level[d.level],
                    target: columnMap.level[d.level+1],
                    measure: columnMap.measure
                }
                tooltip.displayFull(['measure', 'source', 'target'], cm, datum, d3.event);
            })
            .on('mouseout', function() {
                d3.select(this).transition().duration(200).style({
                    'stroke-opacity': .3,
                    'z-index': 1
                });
                tooltip.hide();
            })
            .sort(function(a, b) { return b.dy - a.dy; });

        // Draw nodes
        var node = svg.append("g").selectAll(".node")
            .data(sankeyData.nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
            .style({
                cursor: 'move',
                'fill-opacity': 1,
                'shape-rendering': 'crispEdges'
            })
            .call(d3.behavior.drag().origin(function(d) { return d; })
                .on("dragstart", function(d) {
                    rmvpp.createTrigger(pluginName, columnMap, container, 'nodeClick', d.datum);
                    this.parentNode.appendChild(this);
                })
                .on("drag", dragmove)
            )
            .on("mouseenter", function(d) {
                rmvpp.createTrigger(pluginName, columnMap, container, 'nodeHover', d.datum);

                var filterTargets;
                if (d.targetLinks.length > 0) {
                    filterTargets = 'target';
                } else {
                    filterTargets = 'source';
                }

                // Pass an array with all linked nodes
                var linked = d.sourceLinks.concat(d.targetLinks).map(function(d) {
                    var t = ((filterTargets === 'source') ? 'target' : 'source');
                    return d[t].name;
                });
                linked.push(d.name);

                // Filter
                filterByEntity(d.name, filterTargets, linked);
            })
            .on('mouseleave', filterClear);

        node.append("rect")
            .attr("height", function(d) { return d.dy; })
            .attr("width", nodeWidth)
            .style("fill", function(d) {
                if(d.sourceLinks.length > 0) {
                    d.color = colour(d.name);
                    return d.color;
                }
                d.color = '#EEE';
                return d.color;
            })
            .style("stroke", function(d) {
                return d3.rgb(d.colour).darker(1);
            });

        function nodeWidth(d) {
            if(d.sourceLinks.length > 0) {
                return sankey.nodeWidth();
            }
            return sankey.nodeWidth() / 1.5;
        }

        // Label nodes
        var labels = node.append("text")
            .attr("x", sankey.nodeWidth() + 3)
            .attr("y", function(d) { return d.dy / 2; })
            .attr("dy", ".35em")
            .attr("text-anchor", "start")
            .attr("transform", null)
            .style({
                cursor: 'pointer',
                'font-family': 'monospace',
                'font-size': '11px'
            })
            .text(function(d) { return d.name; });

        labels.filter(function(d) { return d.x < width / 2; })
            .attr("x", -1 * sankey.nodeWidth())
            .attr("text-anchor", "end");

        function filterByEntity(entity, targets, linked) {
            link.classed('inactive', function(d) {
              if(d[targets].name !== entity) {
                return 'inactive';
              }
            });
            link.classed('active', function(d) {
              if(d[targets].name === entity) {
                return 'active';
              }
            });
            link.style('stroke', function(d) {
              if(d[targets].name === entity) {
                return d.color;
              }
              else {
                return d.color;
              }
            });
            link.transition().duration(200).style('stroke-opacity', function(d) {
                if(d[targets].name === entity)
                    return 1;
                else
                    return 0.05;
            });
            link.style('z-index', function(d) {
                if(d[targets].name === entity)
                    return 1000;
                else
                    return 1;
            });
            node.classed('inactive', function(d) {
              return linked.indexOf(d.name) === -1;
            });
            node.transition().duration(200).style('fill-opacity', function(d) {
                if (linked.indexOf(d.name) === -1)
                    return 0.6;
                else
                    return 1;
            });
        }

        function filterClear() {
            link.classed("inactive", false);
            link.classed("active", false);

            link.transition().duration(200).style({
                'stroke-opacity': .3,
                'z-index': 1
            });
            node.classed('inactive', false);
            node.transition().duration(200).style('fill-opacity', 1);
            link.style('stroke', function(d) {
              return d.color;
            });
        }

        function dragmove(d) {
            d3.select(this).attr("transform",
                "translate(" + (
                           d.x = Math.max(0, Math.min(width - d.dx, d3.event.x))
                        ) + "," + (
                           d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
                    ) + ")");
            sankey.relayout();
            link.attr("d", path);
        }
    }

    return rmvpp;


}(rmvpp || {}))
