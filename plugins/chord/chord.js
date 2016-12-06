 rmvpp = (function(rmvpp){
    var pluginName = "chord"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Chord Diagram';
    rmvpp.Plugins[pluginName].description = 'Circular chord diagram showing the relationships between two entities and weighting those relationships by a value.';
    rmvpp.Plugins[pluginName].icon = "connectdevelop";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
			targetProperty:"entities",
			formLabel:"Entities",
			type: 'dim',
            multiple: true,
			required: true,
            desc: 'The attributes to compare relationships between.'
		},
        {
			targetProperty:"measure",
			formLabel:"Measure",
			type: 'fact',
            desc: 'Measure value to weight the relationships between the entities.'
		}
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"size",
			label: "Size",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 800
			},
            desc: 'Size of the chart in pixels.'
		},
        {
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI"	},
            desc: 'Colour palette to use for discrete series colours'
		}
    ];

    rmvpp.Plugins[pluginName].actions = [
        {
            'trigger' : 'groupClick',
            'type' : 'click',
            'output' : ['entities'],
            'name' : 'Click - Group',
            'description' : 'Click on one of the outer group elements on the perimeter of the chord diagram to trigger the event.'
        },
        {
            'trigger' : 'groupHover',
            'type' : 'mouseover',
            'output' : ['entities'],
            'name' : 'Hover - Group',
            'description' : 'Hover over one of the outer group elements on the perimeter of the chord diagram to trigger the event.'
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

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
        if (columnMap.entities.length < 2)
            rmvpp.displayError(container, 'Too few entities chosen to show relationships.')

        // Make full list of entities (names) and lists of individual entities (entNames)
        var entNames = [], uniqueEnts = [];
        columnMap.entities.forEach(function(e, i) {
            var nameArray = data.map(function(d) { return d.entities[i].value; });
            nameArray = d3.set(nameArray).values().map(function(n) {

                // Build arbitrary data object to compensate for the granularity change
                var datum =  { entities: [] };
                for (var j=0; j < columnMap.entities.length; j++) {
                    datum.entities.push({ value : undefined});
                }
                datum.entities[i] = { value : n };
                return {
                    name: n,
                    col: columnMap.entities[i],
                    datum: datum
                };
            });

            entNames.push(nameArray);
            uniqueEnts = uniqueEnts.concat(nameArray);
        });

        var names = uniqueEnts.map(function(e) { return e.name; });

        // Generate data of entities with sub arrays for each related entity
        var linkedData = [];
        columnMap.entities.forEach(function(e, i) {
            entNames[i].forEach(function(obj, j) {
                var name = obj.name;
                var linkVals = [];
                var links = data.filter(function(d) {
                    return d.entities[i].value == name;
                });

                links.map(function(l) {
                    var subLinks = l.entities.filter(function(subE, k) {
                        return k != i;
                    });
                    subLinks = subLinks.map(function(sl) {
                        var obj = {name: sl.value, value: l.measure}
                        return obj;
                    });
                    linkVals = linkVals.concat(subLinks);
                });

                // Aggregate data for multiple levels
                var agg = rmvpp.aggregateData(linkVals, ['name'], 'value', columnMap.measure);
                linkedData.push({name : name, links : agg});
            });
        });

        var outerRadius =config.size / 2, innerRadius = outerRadius - 130;
        var colour = rmvpp.colourScale(names, config.colours); // Set colour scale

        // Chord layout
        var chord = d3.layout.chord()
            .padding(.04)
            .sortSubgroups(d3.descending)
            .sortChords(d3.descending);

        var arc = d3.svg.arc()
            .innerRadius(innerRadius)
            .outerRadius(innerRadius + 20);

        // Main SVG
        var svg = d3.select(container).append("svg")
            .attr("width", outerRadius * 2)
            .attr("height", outerRadius * 2)
          .append("g")
            .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")");

        // Create matrix of points from the dataset
        var indexByName = d3.map(), nameByIndex = d3.map(), objByIndex = d3.map();
        var matrix = [];

        // Compute a unique index for each entity.
        names.forEach(function(d, i) {
            indexByName.set(d, i);
            nameByIndex.set(i, d);
            objByIndex.set(i, uniqueEnts[i]);
        });

        // Construct a square matrix counting package imports.
        linkedData.forEach(function(d) {
            var source = indexByName.get(d.name);
            var row = matrix[source];
            if (!row) {
                row = matrix[source] = [];
                for (var i = -1; ++i < names.length;) row[i] = 0;
            }
            d.links.forEach(function(d) {
                if (columnMap.measure.Code) { // Weight by value
                    row[indexByName.get(d.key)] = +d.values;
                } else { // Just show relationships
                    row[indexByName.get(d.key)]++;
                }
            });
        });

        chord.matrix(matrix);

        var tooltip = new rmvpp.Tooltip(container);
        var g = svg.selectAll(".group")
            .data(chord.groups)
            .enter().append("g")
            .attr("class", "group")
            .on('mouseover', hideGroups)
            .on('mouseout', showChords)
            .on('click', function(d, i) {
                rmvpp.createTrigger(pluginName, columnMap, container, 'groupClick', objByIndex.get(i).datum);
            });

        g.append("path")
            .style("fill", function(d) { return colour(d.index); })
            .style("stroke", function(d) { return colour(d.index); })
            .attr("d", arc);

        g.append("text")
            .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", function(d) {
            return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                + "translate(" + (innerRadius + 26) + ")"
                + (d.angle > Math.PI ? "rotate(180)" : "");
            })
            .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
            .text(function(d) { return nameByIndex.get(d.index); });

        var chord = svg.selectAll(".chord")
            .data(chord.chords)
            .enter().append("path")
            .attr("class", "chord")
            .style('opacity', 0.75)
            .style("stroke", function(d) { return d3.rgb(colour(d.source.index)).darker(); })
            .style("fill", function(d) { return colour(d.source.index); })
            .attr("d", d3.svg.chord().radius(innerRadius))
            .on('mouseover', hideChords);

        // Hide other chords on mouseover
        function hideGroups(d, i) {
            tooltip.hide();
            rmvpp.createTrigger(pluginName, columnMap, container, 'groupHover', objByIndex.get(i).datum);
            chord.transition().duration(200)
                .style("opacity", function(p) {
                    if (p.source.index != i && p.target.index != i) {
                        return 0;
                    } else {
                        return 1;
                    }
                });
        };

        function hideChords(d, i) {
            var html = '<div>'
            html += nameByIndex.get(d.source.index) + ' to ' + nameByIndex.get(d.target.index);
            html += '</div>';
            if (columnMap.measure.Code)
                html += '<div><b>' + columnMap.measure.Name + ': <b><span>' + columnMap.measure.format(d.source.value) + '</span>';
            tooltip.displayHTML(html, d3.event);

            chord.transition().duration(200)
                .style("opacity", function(p) {
                    if (p.source.index == d.source.index && p.target.index == d.target.index) {
                        return 1;
                    } else {
                        return 0.1;
                    }
                });
        }


        function showChords() {
            tooltip.hide();
            chord.transition().duration(200).style('opacity', 0.75);
        }
    }

    return rmvpp;

 }(rmvpp || {}))
