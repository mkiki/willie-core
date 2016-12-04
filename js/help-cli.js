/**
 * willie-core - Help page (client-side code)
 */
// (C) Alexandre Morin 2015 - 2016


/**
 * Distribution by date
 */
function dateDistribution(caption, yAxis, dist) {
  var $details = $("#details-stats");
  $details.children().remove();
  $details.empty();

  function ignore(d) {
    if (!d.year || !d.count) return true;
    if (d.year<1900 || d.year > 2100) return true;
    return false;
  }

  var minY, maxY;
  for (var i=0; i<dist.length; i++) {
    var d = dist[i];
    if (ignore(d)) continue;
    if (minY === undefined || d.year < minY) minY = d.year;
    if (maxY === undefined || d.year > maxY) maxY = d.year;
  }
  var rangeY = [];
  var data = [];
  var map = {}; // key=year, value=indx in rangeY
  for (var i=minY; i<maxY; i++) {
    map[i] = rangeY.length;
    rangeY.push(i);
    data.push(0);
  }
  for (var i=0; i<dist.length; i++) {
    var d = dist[i];
    if (ignore(d)) continue;
    var index = map[d.year];
    if (index===undefined) continue;
    data[index] = d.count;
  }
  $details.highcharts({
    chart: { type: 'areaspline' },
    title: { text: caption },
    xAxis: { categories: rangeY },
    yAxis: { title: { text:yAxis } },
    plotOptions: { areaspline: { fillOpacity: 0.5 } },
    legend: { enabled:false },
    series: [ {name:'Count', data:data} ]
  });
}

/**
 * Distribution by buckets
 */
function bucketDistribution(attr, caption, yAxis, dist) {
  var $details = $("#details-stats");
  $details.children().remove();
  $details.empty();

  function ignore(d) {
    if (!d[attr] || !d.count) return true;
    return false;
  }

  var rangeY = [];
  var data = [];
  for (var i=0; i<dist.length; i++) {
    var d = dist[i];
    if (ignore(d)) continue;
    rangeY.push(d[attr]);
    data.push(d.count);
  }

  $details.highcharts({
    chart: { type: 'areaspline' },
    title: { text: caption },
    xAxis: { categories: rangeY },
    yAxis: { title: { text:yAxis } },
    plotOptions: { areaspline: { fillOpacity: 0.5 } },
    legend: { enabled:false },
    series: [ {name:'Count', data:data} ]
  });
}


/**
 * Keyboard shortcut
 */
function shortcut($parent, key, caption) {
  var $shortcut = $("<div class='shortcut'>").appendTo($parent);
  $("<span class='key'>").text(key).appendTo($shortcut);
  $("<span>").text(caption).appendTo($shortcut);
}



/** ================================================================================
  * Photos stats
  * ================================================================================ */

/**
 * Display a graph showing the distribution of images per date
 */
function photosDateDistribution(dist) {
  dateDistribution("Distribution des images par date", "Number of images", dist);
}

/**
 * Display a graph showing the distribution of images per size
 */
function photosSizeDistribution(dist) {
  var $details = $("#details-stats");
  $details.children().remove();
  $details.empty();

  var resolution = dist.resolution;
  var dist = dist.data;
  var minW, maxW, minH, maxH, maxCount;
  for (var i=0; i<dist.length; i++) {
    var d = dist[i];
    if (!d.width || !d.height || !d.count) continue;
    if (minW === undefined || d.width < minW) minW = d.width;
    if (minH === undefined || d.height < minH) minH = d.height;
    if (maxW === undefined || d.width > maxW) maxW = d.width;
    if (maxH === undefined || d.height > maxH) maxH = d.height;
    if (maxCount === undefined || d.count > maxCount) maxCount = d.count;
  }
  var rangeW = [];
  var rangeH = [];
  for (var i=minW; i<maxW; i+=resolution) { rangeW.push(i); }
  for (var i=minH; i<maxH; i+=resolution) { rangeH.push(i); }
  var data = [];
  for (var i=0; i<dist.length; i++) {
    var d = dist[i];
    if (!d.width || !d.height || !d.count) continue;
    data.push([d.width/resolution, d.height/resolution, d.count]);
  }
  $details.highcharts({        
    chart: { type: 'heatmap' },
    title: { text: 'Distribution des images par taille' },
    xAxis: { categories: rangeW, title:null },
    yAxis: { categories: rangeH, title:null },
    colorAxis: {
      min: 0,
      max: maxCount,
      stops: [
        [0, '#fffbbc'],
        [0.1, '#3060cf'],
        [0.7, '#c4463a'],
        [1, '#c4463a']
      ],
    },
    tooltip: {
      formatter: function () {
        return '' + this.series.xAxis.categories[this.point.x] + ' x ' + this.series.yAxis.categories[this.point.y] + ' <br/>' +
               '<b>Count: ' + this.point.value + '</b>';
      }
    },
    series: [{
        name: 'Image Count',
        borderWidth: 1,
        data: data,
        dataLabels: { enabled: true, color: 'black', style: { textShadow: 'none' } }
    }]
  });
}





/**
 * Update the display with photo stats
 */
function updatePhotosStats(stats) {
  var $photos = $("#stats-photos");
  $photos.children().remove();
  $photos.empty();
  if (!stats.photos) return;

  $("<div class='stats-module-title'>").text("photos").appendTo($photos);

  // Statistics on the number of photos
  if (stats.photos.counts) {
    $("<div class='stats-attr'>").text("" + stats.photos.counts.images + " photos").appendTo($photos);
    $("<div class='stats-attr'>").text("" + stats.photos.counts.errors + " scan errors").appendTo($photos);
    $("<div class='stats-attr'>").text("" + stats.photos.counts.images + " hotos without a onwer").appendTo($photos);
  }
  
  // Last time collection was scanned
  var lastScanned = stats.photos.lastScanned;
  if (!lastScanned || lastScanned==='') lastScanned = 'Never scanned';
  else lastScanned = "Updated " + moment(lastScanned).fromNow();
  $("<div class='stats-attr'>").text("" + lastScanned).appendTo($photos);

  // Distribution of images per date
  var $buttons = $("<div class='stats-buttons'>").appendTo($photos);
  $("<button class='stats-button'>").text("Images distribution over time").appendTo($buttons).click(function() { photosDateDistribution(stats.photos.distByDate); });
  $("<button class='stats-button'>").text("Images size distribution").appendTo($buttons).click(function() { photosSizeDistribution(stats.photos.distBySize); });

  // Keyboard shortcuts
  var $shortcuts = $("<div class='stats-shortcuts'>").appendTo($photos);
  shortcut($shortcuts, "z", "Force thumbnails and exif regeneration for selection");
  shortcut($shortcuts, "h", "Hide image");
  shortcut($shortcuts, "c", "Set image as cover");
  shortcut($shortcuts, "t + <key>", "Toggle a tag for the selection");
}


/** ================================================================================
  * Core stats
  * ================================================================================ */

function coreJobs() {
  var $details = $("#details-stats");
  $details.children().remove();
  $details.empty();

  var $jobs = $("<div class='jobs'>").appendTo($details);
  var $listInProgress = $("<table class='jobs-in-progress'>");
  var $listCompleted = $("<table class='jobs-completed'>");
  var countInProgress = 0;
  var countCompleted = 0;

  var url = '/jobs';
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(jobs) {
      var $header = $('<tr class="jobs-table-header">').appendTo($listInProgress);
      $('<td>').text("Job in progress").appendTo($header);
      $('<td>').text("Started").appendTo($header);
      $('<td>').text("Status").appendTo($header);
      $('<td>').text("Progress").appendTo($header);
      $('<td>').text("UUID").appendTo($header);

      var $header = $('<tr class="jobs-table-header">').appendTo($listCompleted);
      $('<td>').text("Job completed").appendTo($header);
      $('<td>').text("Finished").appendTo($header);
      $('<td>').text("Status").appendTo($header);
      $('<td>').text("Duration").appendTo($header);
      $('<td>').text("UUID").appendTo($header);

      function newRow(job) {
        if (!job.progress) return;
        var inProgress = true;
        var ended = undefined;
        var now = new Date().getTime();
        var updated = moment(job.updated).unix()*1000;
        if ((now-updated) >= 1000*60*15) { inProgress = false; ended = moment(job.updated); }    // Not updated in the last 15 minutes => consider finished
        if (job.type === 'scan' && job.progress.reverseScan.ended) { inProgress = false; ended = moment(job.progress.reverseScan.ended); }

        var $row = $('<tr class="jobs-table-row">');
        if (inProgress) {
          countInProgress = countInProgress + 1;
          $('<td>').text(job.name).appendTo($row);
          $('<td>').text(moment(job.started).fromNow()).appendTo($row);
          $('<td>').text(job.status).appendTo($row);
          var $progress = $('<td>').appendTo($row);
          var $indicator = $('<div class="jobs-progress-indicator">').appendTo($progress);

          if (job.type==='scan' && job.progress.reverseScan.fingerprints > 0) {
            var progress = job.progress.reverseScan.scanned / job.progress.reverseScan.fingerprints;
            //var errors = job.progress.reverseScan.errors / job.progress.reverseScan.fingerprints;
            $('<div class="jobs-progress-indicator-progress">').width(Math.floor(200*progress)).appendTo($indicator);
            //$('<div class="jobs-progress-indicator-errors">').width(Math.ceil(200*errors)).appendTo($indicator);
          }
          $('<td>').text(job.uuid).appendTo($row);
          $listInProgress.append($row);
        }
        else {
          countCompleted = countCompleted + 1;
          $('<td>').text(job.name).appendTo($row);
          $listCompleted.append($row);
          $('<td>').text(moment(ended).format("lll")).appendTo($row);
          $('<td>').text(job.status).appendTo($row);
          var duration = moment.duration(ended.subtract(moment(job.started), 'milliseconds'));
          $('<td>').text(duration.humanize()).appendTo($row);
          $('<td>').text(job.uuid).appendTo($row);
        }

      }

      for (var i=0; i<jobs.length; i++) {
        newRow(jobs[i]);
      }

      if (countInProgress > 0) {
        $("<h2>").text('In progress').appendTo($jobs);
        $listInProgress.appendTo($jobs);
      }
      if (countCompleted > 0) {
        $("<h2>").text('Completed').appendTo($jobs);
        $listCompleted.appendTo($jobs);
      }

    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load jobs", jqxhr.status);
    }
  });
}

/**
 * Update the display with core stats
 */
function updateCoreStats(stats) {
  var $core = $("#stats-core");
  $core.children().remove();
  $core.empty();
  if (!stats.core) return;

  $("<div class='stats-module-title'>").text("core").appendTo($core);

  // Distribution of images per date
  var $buttons = $("<div class='stats-buttons'>").appendTo($core);
  $("<button class='stats-button'>").text("Show curent jobs").appendTo($buttons).click(function() { coreJobs(); });
}




/** ================================================================================
  * Tree Register stats
  * ================================================================================ */

/**
 * Update the display with tree register stats
 */
function updateTreeregisterStats(stats) {
  var $treeRegister = $("#stats-treeregister");
  $treeRegister.children().remove();
  $treeRegister.empty();
  if (!stats.treeRegister) return;

  $("<div class='stats-module-title'>").text("treeregister").appendTo($treeRegister);
}



/** ================================================================================
  * Miouzik stats
  * ================================================================================ */


function miouzikDateDistribution(dist) {
  dateDistribution("Distribution des pistes par date", "Number of songs", dist);
}
function miouzikGenreDistribution(dist) {
  bucketDistribution("genre", "Distribution des pistes par genre", "Number of songs", dist);
}

/**
 * Update the display with core stats
 */
function updateMiouzikStats(stats) {
  var $miouzik = $("#stats-miouzik");
  $miouzik.children().remove();
  $miouzik.empty();
  if (!stats.miouzik) return;

  $("<div class='stats-module-title'>").text("miouzik").appendTo($miouzik);
  $("<div class='stats-attr'>").text("" + stats.miouzik.counts.songCount + " songs").appendTo($miouzik);
  $("<div class='stats-attr'>").text("" + stats.miouzik.counts.artistCount + " artists").appendTo($miouzik);
  $("<div class='stats-attr'>").text("" + stats.miouzik.counts.albumCount + " albums").appendTo($miouzik);

  // Distribution of songs per date
  var $buttons = $("<div class='stats-buttons'>").appendTo($miouzik);
  $("<button class='stats-button'>").text("Songs distribution over time").appendTo($buttons).click(function() { miouzikDateDistribution(stats.miouzik.distByYear); });
  $("<button class='stats-button'>").text("Songs distribution by genre").appendTo($buttons).click(function() { miouzikGenreDistribution(stats.miouzik.distByGenre); });
}




/** ================================================================================
  * All stats
  * ================================================================================ */


/**
 * Update all modules stats
 */
function updateStats(stats) {
  updateCoreStats(stats);
  updatePhotosStats(stats);
  updateTreeregisterStats(stats);
  updateMiouzikStats(stats);
}

/**
 * Main
 */
$(function() {
  createMenu(document.sideMenu, "help");

  return ajax({
    type: 'GET',
    url: '/stats',
    dataType: 'json',
    success: function(stats) {
      return updateStats(stats);
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to get statistics", jqxhr.status);
    }
  });

});
