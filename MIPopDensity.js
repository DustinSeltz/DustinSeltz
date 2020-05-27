/*eslint-env es6*/
/*eslint-env browser*/
/*eslint no-console: 0*/
/*global d3 */
/*global topojson */


//Based on Assignment 8, scatterplot, as well as CApopDensityD3V4 example / https://bl.ocks.org/mbostock/5562380
//Uses of other code is commented

//TODO size width and height based on window size instead of raw pixels?
//Define Margin
var margin = {left: 80, right: 80, top: 50, bottom: 50 }, 
    width = 960 - margin.left -margin.right,
    height = 800 - margin.top - margin.bottom;

//Define SVG
var svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
/*
//Define Color 
//https://stackoverflow.com/questions/40070590/what-is-the-replacement-of-d3-scale-category10-range-in-version-4
var colors = d3.scaleOrdinal(d3.schemeCategory10);
// d3-scale-chromatic might work better since we have >10 https://piazza.com/class/k7zfbo276ik5jb?cid=89
*/

//Based on ch14 example 19
//Define map projection
var projection = d3.geoMercator()
    .translate([width/2, height/2])
    .scale([width * 0.16]);

//Define path generator
var path = d3.geoPath()
    .projection(projection);
//https://www.sohamkamani.com/blog/javascript/2019-02-18-d3-geo-projections-explained/


//TODO currently the color function and legend are just copied from the California example. 
var color1 = d3.scaleThreshold()
    .domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
    .range(d3.schemeOrRd[9]);
//TODO make the scheme with different domain. Possibly threshold based on number of data points for each bin.
var color2 = d3.scaleThreshold()
    .domain([1, 10, 50, 200, 500, 1000, 2000, 4000])
    .range(d3.schemeBuPu[9]);

var x = d3.scaleSqrt()
    .domain([0, 4500])
    .rangeRound([440, 950]);

var g = svg.append("g")
    .attr("class", "key")
    .attr("transform", "translate(0,40)");

//TODO so this is the legend, right? Coloring it. WIll need to stick this in a function and re-generate it with new color
g.selectAll("rect")
  .data(color1.range().map(function(d) {
      d = color1.invertExtent(d);
      if (d[0] == null) d[0] = x.domain()[0];
      if (d[1] == null) d[1] = x.domain()[1];
      return d;
    }))
  .enter().append("rect")
    .attr("height", 8)
    .attr("x", function(d) { return x(d[0]); })
    .attr("width", function(d) { return x(d[1]) - x(d[0]); })
    .attr("fill", function(d) { return color1(d[0]); });

g.append("text")
    .attr("class", "caption")
    .attr("x", x.range()[0])
    .attr("y", -6)
    .attr("fill", "#000")
    .attr("text-anchor", "start")
    .attr("font-weight", "bold")
    .text("Population per square mile");

g.call(d3.axisBottom(x)
    .tickSize(13)
    .tickValues(color1.domain()))
  .select(".domain")
    .remove();

//Get list of county FIPS in the data
function getSource(data){
    //var baseUrl = "https://www.census.gov/quickfacts/fact/table/";
    var countyFips = "";
    for(var i = 0; i < data.objects.counties.geometries.length; ++i){
        countyFips += data.objects.counties.geometries[i].id + ",";
    }
    console.log("fipsCounties len=",i);
    //var sourceUrl = baseUrl + countyFips
    //return sourceUrl;
    return "["+countyFips+"]";
}

//We're going to have to use the data after the function ends. Can just store it globally for now
var MIdata;
var nextColorScheme = color2;
var tractsVisible = false;

//Based on scatterplot function which was based on book
function displayTooltip(d){
    //Update the tooltip position
    d3.select("#tooltip")
        //https://bl.ocks.org/d3noob/a22c42db65eb00d4e369
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY) + "px");

    //Unfortunately, it seems like the data isn't in d. TODO fix this somewhere else, this isn't efficient
    //Get data by FIPS id, since the d parameter we have isn't all the data we need
    let id = parseInt(d.id);
    let geoCountyData = {};
    for(let i = 0; i < MIdata.objects.counties.geometries.length; ++i){
        if(MIdata.objects.counties.geometries[i].id == id){
            geoCountyData = MIdata.objects.counties.geometries[i];
            //console.log("Matched data: ", data.objects.counties.geometries[i]);
            break;
        }
    }
    let countyName = geoCountyData["County name"]
    let countyPop = geoCountyData["Population est 2019"];
    let countyArea = geoCountyData["Area"];
    let density = countyPop / countyArea;

    //Round to two digits. I can find where the . is and then go at most a number of characters afterwards
    //TODO maybe stick this in a function
    let digitsAfterDecimal = 2;
    let decimalChar = '.';
    density = String(density);
    //The starting value of periodIndex just needs to be small enough that it won't trigger the conditional
    for(let i = 0, periodIndex = 0-digitsAfterDecimal-1; i < density.length; ++i){
        if(density[i] === decimalChar){
             periodIndex = i;
        }
        if(i === periodIndex + digitsAfterDecimal){
            //console.log("Density unrounded was ", density);
            density = density.slice(0, i+1);
            //console.log("Density is now ", density);
            break;
        }
    }

    //Set values
    d3.select("#tooltip")
        .select("#tooltip_county")
        .text(countyName);
    d3.select("#tooltip")
        .select("#tooltip_population")
        .text(countyPop);
    d3.select("#tooltip")
        .select("#tooltip_area")
        .text(countyArea)
    d3.select("#tooltip")
        .select("#tooltip_density")
        .text(density);
    //Show the tooltip
    d3.select("#tooltip").classed("hidden", false);
}

//
function drawCounties(data, color){
    //From the California map, https://bl.ocks.org/mbostock/5562380
    svg.append("g")
        .selectAll("path")
        .data(topojson.feature(data, data.objects.counties).features)
        .enter().append("path")
            //.attr("fill", function(d) { console.log("Test:", d); return "blue";})
            .attr("fill", function(d) {
                //Showing it in white lets us see boundaries between counties easily. Looks like the borders are displaying well. 
                //return "white";
                //TODO this shares some code with the tooltip function, should probably put this in a function. Or fix the data so it's unneeded
                //Get data by FIPS id, since the d parameter we have isn't all the data we need
                let id = parseInt(d.id);
                let geoCountyData = {};
                for(let i = 0; i < data.objects.counties.geometries.length; ++i){
                    if(data.objects.counties.geometries[i].id == id){
                        geoCountyData = data.objects.counties.geometries[i];
                        //console.log("Matched data: ", data.objects.counties.geometries[i]);
                        break;
                    }
                }
                let countyName = geoCountyData["County name"];
                let countyPop = geoCountyData["Population est 2019"];
                let countyArea = geoCountyData["Area"];
                let density = countyPop / countyArea;
                console.log(countyName, "density=", density, " with ", color(density));
                return color(density); 
            })
            .attr("d", path)
            .attr("stroke", "#000")
            .attr("stroke-opacity", 0.3)
            .attr("class", "county")
            //Density for now, value that turns into color
            .attr("value", function(d) {
                //TODO copied code from above, stick it in a function or something. 
                let id = parseInt(d.id);
                let geoCountyData = {};
                for(let i = 0; i < data.objects.counties.geometries.length; ++i){
                    if(data.objects.counties.geometries[i].id == id){
                        geoCountyData = data.objects.counties.geometries[i];
                        //console.log("Matched data: ", data.objects.counties.geometries[i]);
                        break;
                    }
                }
                let countyPop = geoCountyData["Population est 2019"];
                let countyArea = geoCountyData["Area"];
                let density = countyPop / countyArea;
                return density;
            })
            /*
            .attr("class", function(d){
                if(colors === color1){
                    return "countyColor1";
                } else {
                    return "countyColor2";
                }
            })
            */
            //Tooltip, based on my scatterplot code, which was based on the book.
            .on("mouseover", function(d){displayTooltip(d);})
            //Moving your mouse around moves the tooltip as well, looks a bit nicer. 
            .on("mousemove", function(d){displayTooltip(d);})
            //Hides again when you mouse off of the circle. 
            .on("mouseout", function() {
                d3.select("#tooltip").classed("hidden", true);
            })
    ;
}

function drawTracts(data){
    //Similar to the CApopDensity example
    svg.append("path")
        .datum(topojson.feature(data, data.objects.tl_2016_26_tract))
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-opacity", 0.3)
        .attr("class", "tract")
        .attr("d", path);
}


var inputFileName = "MI.json";
d3.json(inputFileName).then(function(data) {
    console.log("Read data:", data);
    
    //TODO I'm already adding data to the json to produce MI.json, I could just modify that script to remove this stuff.
    //Remove all non-michigan states
    var michiganFIPS = 26;
    var michigan = {};
    for(let i = 0; i < data.objects.states.geometries.length; ++i){
        if(data.objects.states.geometries[i].id == michiganFIPS){
            console.log(data.objects.states.geometries[i], data.objects.states.geometries[i].id);
            michigan = data.objects.states.geometries[i];
            break;
        }
    }
    data.objects.states.geometries = [michigan];
    
    //Remove all non-michigan county data
    var michiganCounties = [];
    for(let i = 0; i < data.objects.counties.geometries.length; ++i){
        //Remove the right 3 digits from the 6 digit code, to tell if the left portion matches the state.
        if(parseInt((data.objects.counties.geometries[i].id)/1000) == michiganFIPS){
            console.log(parseInt((data.objects.counties.geometries[i].id)/1000));
            michiganCounties.push(data.objects.counties.geometries[i]);
            //console.log(data.objects.states.geometries[i]);
            //delete data.objects.counties.geometries[i];
        }
    }
    data.objects.counties.geometries = michiganCounties;
    
    //Remove all non-michigan land/tract data TODO
    /*var michiganLand = {};
    
    for(let i = 0; i < data.objects.land.geometries.length; ++i){
        if(data.objects.states.geometries[i].id == michiganFIPS){
            console.log(data.objects.states.geometries[i], data.objects.states.geometries[i].id);
            michigan = data.objects.states.geometries[i];
        }
    }*/
    //We actually don't have ids in there. Is it by index ? Can't be ?
    //data.objects.land.geometries = data.objects.land.geometries[michiganFIPS];
    
    console.log("Michigan: ", data);
    //Print out a list of FIPS for Michigan's counties for querying in Python
    console.log("County FIPS: ", getSource(data));
    
    //Relies on topojson, <script src="https://d3js.org/topojson.v3.min.js"></script>
    //Sizes the display based on the data and the space we have to display it
    projection.fitExtent([ [ 0, 0 ], [ width, height ] ], topojson.feature(data, data.objects.states));
    
    
    
    //TODO is this even needed? Counties just draws over it ?
    svg.append("g")
        .selectAll("path")
        //.data(topojson.feature(data, data.objects.tracts).features) //TODO what is 'tracts'?
        .data(topojson.feature(data, data.objects.states).features) //TODO equivalent?
        .enter().append("path")
            .attr("fill", function(d) { console.log("g d=", d); return "#C0C0C0"})//TODO this probably doesn't matter at all? We need to color counties separate from the state
            //.attr("fill", function(d) { console.log("Filling d=",d, "\ndensity=", d.properties.density, " with ", color(d.properties.density)); return color(d.properties.density); })
            .attr("d", path);
    
    //Button to switch color schemes
    //TODO probably position it just below the legend? And put text in it. 
    var schemeButtonWidth = 40;
    var schemeButtonHeight = 30;
    svg.append("g")
        //.attr("class", "schemeButton")
        .append("rect")
        .attr("x", width-schemeButtonWidth)
        .attr("y", height-schemeButtonHeight)
        .attr("width", schemeButtonWidth)
        .attr("height", schemeButtonHeight)
        .style("fill", "#C0C0C0C0")
        .on("click", function() {
            console.log("Changing scheme");
            //Create new ones of the correct color
            //drawCounties(data, nextColorScheme);
            //Na, just update their colors
            var elems = document.getElementsByClassName('county');
            for(let i = 0; i < elems.length; ++i){
                let county = elems[i];
                county.style.fill = nextColorScheme(county.getAttribute("value"));
            }
            //We're toggling between two schemes, invert. 
            if(nextColorScheme === color1){
                nextColorScheme = color2;
            } else {
                nextColorScheme = color1;
            }
            //TODO we really should remove the old one. Currently they just stack on top.
        })
    ;
    var buttonPadding = 10;
    
    //Button to switch toggle tracts
    var tractButtonWidth = 40;
    var tractButtonHeight = 30;
    svg.append("g")
        //.attr("class", "tractButton")
        .append("rect")
        .attr("x", width-tractButtonWidth)
        .attr("y", height-tractButtonHeight-schemeButtonHeight-buttonPadding)
        .attr("width", tractButtonWidth)
        .attr("height", tractButtonHeight)
        .style("fill", "#C0C0C0C0")
        .on("click", function() {
            console.log("Toggling tract visibility");
            //Based on https://stackoverflow.com/questions/19353331/getting-or-changing-css-class-property-with-javascript-using-dom-style
            //TODO is this really the best way to do it? Can I just change the CSS class properties?
            var elems = document.getElementsByClassName('tract');
            if(tractsVisible){
                for(let i = 0; i < elems.length; ++i){
                    elems[i].style.visibility = 'hidden';
                }
            } else {
                for(let i = 0; i < elems.length; ++i){
                    elems[i].style.visibility = 'visible';
                    //Lets make sure these lines show on top
                    //That's not working, newly created stuff displays on top. Maybe just toggle visibility for those as well. 
                    //elems[i].style["z-index"] = 100;
                }
            }
            tractsVisible = !tractsVisible;
        })
    ;
    
    
    //We'll need this data later for recoloring, etc
    MIdata = data;
    
    //drawCounties(data, color2);
    drawCounties(data, color1);
});


var tractInputFileName = "tl_2016_26_tract_topo.json";
d3.json(tractInputFileName).then(function(data) {
    console.log("Tracts: ", data);
    drawTracts(data);
});