/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    items: [ {xtype: 'container', itemId: 'chart_box'}, {xtype:'container',itemId:'table_box'} ],
    valid_verdicts: [ "Not Run" ],
    first_day: '2012-10-21',
    last_day: '2012-11-21',
    launch: function() {
        this._getVerdictNames();
    },
    _getVerdictNames: function() {
        var that = this;
        Rally.data.ModelFactory.getModel({
            type: 'TestCaseResult',
            success: function(model) {
                var verdicts = model.getField("Verdict").allowedValues;
                Ext.Array.each( verdicts, function( verdict ) {
                    that.valid_verdicts.push( verdict.StringValue );
                });
                that._getTestResults();
            }
        });
    },
    _getTestResults: function() {
    	console.log( "_getTestResults()" );
    	Ext.create('Rally.data.WsapiDataStore', {
    		model: 'TestCase',
    		listeners: {
    			scope: this,
    			load: function(store,data,success) {
    				var that = this;
    				var tc_result_counts = {};
    				Ext.Array.each( data, function( tc ) {
    					console.log( tc.data.Name );
    					tc_result_counts[ tc.data.FormattedID ] = that.getVerdictsByDay(tc.data.Results); 
    				});
    				var tc_result_counts_by_date = that.getResultCountsByDate( tc_result_counts );
                    that.makeChart(tc_result_counts_by_date);
    			}
    		},
    		fetch: ['Name','FormattedID','Results','Date','Verdict'],
    		autoLoad: true
    	});
    },
    /* given an array of test case results,  
     * return a hash where key is date and value is the last verdict that day
     */
    getVerdictsByDay: function( results ) {
    	console.log( results );
    	var tc_verdicts_by_day = {};
    	Ext.Array.each( results, function(tcr) {
    		// adjust date for timezone, remove time
    		var run_date = Rally.util.DateTime.toIsoString(Rally.util.DateTime.fromIsoString(tcr.Date), false).replace(/T[\W\w]*/,"");
    		tc_verdicts_by_day[ run_date ] = tcr.Verdict;
    		console.log( run_date, tcr.Verdict );
    	});
    	console.log( tc_verdicts_by_day );
    	tc_verdicts_by_day = this.fillInDates(this.first_day,this.last_day,tc_verdicts_by_day);
    	return tc_verdicts_by_day;
    },
    /*
     * given a hash of verdicts (key is TC id, value is hash of verdicts (key is date, value is verdict))
     * returns a count of verdicts by date
     */
    getResultCountsByDate: function( tc_result_counts ) {
    	console.log( tc_result_counts );
    	var counts = {}; // key is date
    	for ( var tc in tc_result_counts ) {
    		if ( tc_result_counts.hasOwnProperty(tc) ) {
    			var tc_results = tc_result_counts[tc];
    			for ( var run_date in tc_results ) {
    				var verdict = tc_results[run_date];
    				
    				if ( tc_results.hasOwnProperty(run_date) ) {
    					if ( !counts[run_date] ) {
    						counts[run_date] = { "Not Run": 0 };
    					}
    					if ( !counts[run_date][verdict] ) {
    						counts[run_date][verdict] = 0;
    					}
    					counts[run_date][verdict] += 1;
    				}
    			}
    		}
    	}
    	console.log(counts);
    	return counts;
    },
    fillInDates: function(first_day,last_day,tc_verdicts_by_day){
    	console.log( "fillDates", first_day, last_day, tc_verdicts_by_day );
    	var filled_day = {};
    	var day = first_day;
    	var current_verdict = null;
		while ( day <= last_day ) {
			if ( tc_verdicts_by_day[day] ) {
				current_verdict = tc_verdicts_by_day[day];
				filled_day[day] = current_verdict;
			} else {
				filled_day[day] = "Not Run";
				if ( current_verdict ) {
					filled_day[day] = current_verdict;
				}
			}
			day = Rally.util.DateTime.toIsoString(Rally.util.DateTime.add(Rally.util.DateTime.fromIsoString(day), "day", 1),true).replace(/T[\W\w]*/,"");
    	}
    	return filled_day;
    },
    makeChart: function(tc_result_counts_by_date) {
        // switch to an array of series(es?)
        var series = {};
        var series_array = [];
        Ext.Array.each( this.valid_verdicts, function(verdict) {
            series[verdict] = { 
                type: 'column',
                name: verdict,
                data: []
            }
        });
        for ( var run_date in tc_result_counts_by_date ) {
            if ( tc_result_counts_by_date.hasOwnProperty(run_date) ) {
                var js_date = Rally.util.DateTime.fromIsoString(run_date);
                var counts = tc_result_counts_by_date[run_date];
                Ext.Array.each( this.valid_verdicts, function(verdict) {
                    if ( counts[verdict] ) {
                        series[verdict].data.push( [ js_date.getTime(), counts[verdict] ] );
                    }
                });
            }
        }
        
        for ( var i in series ) {
            if ( series.hasOwnProperty(i) ) {
                series_array.push(series[i]);
            }
        }
        console.log(series);
        var chart = Ext.create( 'Rally.ui.chart.Chart', {
            chartConfig: {
                chart: {},
                title: { text: 'Number of Test Case Results', align: 'center' },
                xAxis: { type: 'datetime' },
                plotOptions: { column: { stacking: 'normal' } },
                series: series_array
            }
        });
        this.down('#chart_box').add(chart);
    }
});
