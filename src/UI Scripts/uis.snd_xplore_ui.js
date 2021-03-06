/*
  Controls the SND Xplore UI
*/

// Delay a function, overriding any previous calls for the same id
var delay = (function () {
  var timers = {};
  return function (id, callback, ms) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(callback, ms);
  };
})();

// get the minutes, seconds and decisecond since a given time, e.g. 01:32.1
function getMinutesSince(startTime) {
  var t = new Date().getTime() - startTime;
  var ds = Math.floor((t/100) % 10);
  var seconds = Math.floor((t/1000) % 60);
  var minutes = Math.floor((t/1000/60) % 60);
  if (minutes < 10) minutes = '0' + minutes;
  if (seconds < 10) seconds = '0' + seconds;
  return minutes + ':' + seconds + '.' + ds;
}

/*************************************
              XPLORE
**************************************/
var snd_xplore_util = {
  countup_interval: null,
  loading: function () {
    $('#xplore_btn')
        .prop('disabled', true)
        .html('Loading... <i class="glyphicon glyphicon-refresh ' +
              'glyphicon-refresh-animate"></i>');

    $('#cancel_btn').prop('disabled', false).text('Cancel').show();
    $('#output_loader').addClass('active');

    var start = new Date().getTime();
    snd_xplore_util.countup_interval = setInterval(function () {
      $('#countup').text(getMinutesSince(start));
    }, 100);
  },
  loadingComplete: function () {
    $('#xplore_btn')
        .html('Run')
        .prop('disabled', false);

    $('#cancel_btn').hide();
    $('#output_loader').removeClass('active');
    // make sure we are on the output tab
    $('#script_output_tab').tab('show');
    // scroll to the top of the output div
    $('#output_tabs_pane').animate({ scrollTop: 0 }, "fast");

    clearInterval(snd_xplore_util.countup_interval);

    // Google Code-Prettify
    window.PR.prettyPrint();
  },
  execute: function () {
    // summary:
    //   Gather the data from the client and run Xplore

    var code = '';
    if (typeof snd_xplore_editor === 'object') {
      code = snd_xplore_editor.getValue();
    } else {
      code = document.getElementById('snd_xplore').value;
    }

    var params = {
      code: code,
      user_data: document.getElementById('user_data_input').value,
      runAt: document.getElementById('target').value,
      breadcrumb: snd_xplore_reporter.getBreadcrumb(),
      reporter: snd_xplore_reporter,
      show_props: $('#show_props').is(':checked'),
      show_strings: $('#show_strings').is(':checked'),
      html_messages: $('#show_html_messages').is(':checked')
    };

    snd_xplore(params);
  },
  executeNew: function () {
    snd_xplore_reporter.clearBreadcrumb();
    this.execute();
  },
  demo: function (code, user_data) {
    var $user_data_input;

    snd_xplore_util.toggleEditor(true, function () {
      $('#target').val('server');
      $('#scope').val('global');
      snd_xplore_editor.setValue(code);
      snd_xplore_editor.focus();

      if (user_data) {
        $user_data_input = $('#user_data_input');
        if (!$user_data_input.val()) {
          $user_data_input.val(user_data);
        }
      }
    });
  },
  toggleEditor: (function () {
    var output_left = 300;
    var state = 1;
    return function (force, callback) {
      var $this = $('#editor_toggle');
      var $editor = $('#editor');
      var $output = $('#output');
      if ((force === true && state === 1) || (force === false && state === 0)) {
        if (typeof callback === 'function') callback();
        return;
      }
      if ($editor.is(":hidden") || force === true) {
        $output.animate({left: $editor.outerWidth()}, 400, function () {
          $editor.fadeIn(400);
          $this.addClass('active');
          state = 1;
          if (typeof callback === 'function') callback();
        });
      } else {
        $editor.fadeOut(400, function () {
          $output.animate({left: 0}, 400, function () {
            output_left = $output.css('left');
            $this.removeClass('active');
            state = 0;
            if (typeof callback === 'function') callback();
          });
        });
      }
    };
  })(),
  cancel: function () {
    // add status=true to get the current status
    $.ajax('/cancel_my_transaction.do?sysparm_output=xml', {
      dataType: 'xml'
    });
    $('#cancel_btn').prop('disabled', true).text('Cancelling...');
  }
};

$('.xplore_demo').on('click', 'a', function (e) {
  e.preventDefault();
  $this = $(this);
  var code, user_data;
  switch ($this.attr('data-demo')) {
    case 'GlideRecord':
      code = 'var gr = new GlideRecord(\'incident\');\n//gr.addQuery(\'\');\ngr.setLimit(1);\ngr.query();\ngr.next();\ngr';
      break;
    case 'Array':
      code = "var a = [];\na.push(['a', 'b', 'c']);\na.push(['x', 'y', 'z']);\na";
      break;
    case 'GlideUser':
      code = "gs.getUser();";
      break;
    case 'Logging':
      code = "gs.debug('Do you like to debug?');\ngs.addInfoMessage('You are using Xplore');";
      break;
    case 'scope':
      code = "this";
      break;
    case 'user_data':
      code = 'var doc = new XMLDocument(user_data);\ndoc.toIndentedString();';
      user_data = '<?xml version="1.0" encoding="UTF-8" ?><xml><incident><active>true</active></incident></xml>';
      $('#user_data_tab').tab('show');
      break;
  }
  if (code) {
    snd_xplore_util.demo(code, user_data);
  }
});

/*************************************
              REGEX
**************************************/
var snd_xplore_regex_util = (function () {
  $intro_panel   = $('#regex_intro_panel');
  $match_panel   = $('#regex_match_panel');
  $group_panel   = $('#regex_group_panel');
  $error_panel   = $('#regex_error_panel');
  $result        = $('#regex_match');
  $result_groups = $('#regex_group');
  function showIntro() {
    $match_panel.hide();
    $group_panel.hide();
    $error_panel.hide();
    $intro_panel.fadeIn();
  }
  function showError(text) {
    $('#regex_error').empty().append(text);
    $intro_panel.hide();
    $match_panel.hide();
    $group_panel.hide();
    $error_panel.fadeIn();
  }
  function showResult(matches, groups) {
    $intro_panel.hide();
    $error_panel.hide();
    $result.empty().append(matches);
    $match_panel.fadeIn();
    if (groups) {
      $result_groups.empty().append(groups);
      $group_panel.fadeIn();
    } else {
      $group_panel.hide();
    }
  }

  snd_xplore.regex.addEvent('start', function () {
    $('#regex_loading').fadeIn();
  });

  var escapeHtml = (function () {
    var map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    };
    var replace = function (c) {
      return map[c];
    };
    return function (text) {
      return text.replace(/<|>|&/g, replace);
    };
  })();

  snd_xplore.regex.addEvent('done', function(result) {
    var matchHtml, groupHtml;
    if (result) {
      if (result.error) {
        showError(result.error);
      } else if (result.matches){
        matchHtml = '';
        $.each(result.matches, function (i, item) {
          item.text = escapeHtml(item.text);
          if (item.type == 'match') {
            matchHtml += '<span class="bg-success text-success">' + item.text + '</span>';
          } else {
            matchHtml += item.text;
          }
        });
        groupHtml = '';
        if (result.groups) {
          if (result.groups.join('').length) {
            $.each(result.groups, function (i, item) {
              groupHtml += '<h5 class="text-danger">Match ' + (i + 1) + '</h5>';
              groupHtml += '<ol>';
              $.each(item, function (i, group) {
                groupHtml += '<li>' + escapeHtml(group) + '</li>';
              });
              groupHtml += '</ol>';
            });
          }
        }
        showResult(matchHtml, groupHtml);
      } else {
        showError('No result was given.');
      }
    } else {
      showIntro();
    }
    $('#regex_loading').hide();
  });

  // setup the handler to run the regex when the user edits something
  var run = (function () {
    var cache = '';
    return function () {
      var expression = $('#regex').val();
      var input = $('#regex_input').val();
      var options = $('#regex_options').val();

      if (!expression || !input) {
        showIntro();
        return;
      }

      if (cache === input + expression + options) {
        return;
      }
      cache = input + expression + options;

      snd_xplore.regex({
        expression: expression,
        input:      input,
        options:    options,
        target:     $('#target').val()
      });
    };
  })();

  return {
    run: run
  };
})();

/*************************************
              TABLES
**************************************/
var snd_xplore_table_util = (function () {

  var api = {
    tables: {},
    current: ''
  };

  function loadTables() {
    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getTables',
      dataType: 'json'
    }).
    done(function (result) {
      api.tables = result;
    }).
    fail(function () {
      snd_log('Error: loadTables failed.');
    });
  }
  api.loadTables = loadTables;

  function getTableHierarchy(table, search_labels) {
    loading(true);
    api.current = table;
    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getTableHierarchy' +
            '&table=' + table +
            '&search_labels=' + (search_labels ? '1' : '0'),
      dataType: 'json'
    }).
    done(function (result) {
      var $target = $('#table_hierarchy_result').empty();

      if ('success' in result && result.success === false) {
        $target.append('<div class="alert alert-danger"><strong>' + result.message + '</strong></div>');
        loading(false);
        return;
      }

      function generateHtml(dbo) {
        var html = '<li>';
        if (api.current == dbo.name) {
          html += '<span class="bg-success text-success">' + dbo.label + '</span>';
        } else {
          html += dbo.label;
        }
        html += ' [<a href="#show" data-show="' + dbo.name + '">' +
            dbo.name + '</a>]';
        html += ' <a href="' + dbo.name + '_list.do" target="_blank" title="Open list"><i class="glyphicon glyphicon-list-alt" /></a>';
        html += ' <a href="' + dbo.name + '.do" target="_blank" title="Open form"><i class="glyphicon glyphicon-open-file" /></a>';
        html += ' <a href="sys_db_object.do?sys_id=' + dbo.sys_id + '" target="_blank" title="Open table definition"><i class="glyphicon glyphicon-cog" /></a>';
        if (dbo.children.length) {
          html += '<ul>';
          $.each(dbo.children, function (i, childDbo) {
            html += generateHtml(childDbo);
          });
          html += '</ul>';
        }
        html += '</li>';
        return html;
      }
      if (result.length) {
        $.each(result, function (i, dbo) {
          $target.append('<ul>' + generateHtml(dbo) + '</ul>');
        });
      } else {
        $target.append('<div class="alert alert-danger"><strong>No table information found.</strong></div>');
      }
      loading(false);
    }).
    fail(function () {
      loading(false);
      snd_log('Error: getTableHierarchy failed.');
    });
  }

  function loading(b) {
    if (b) {
      $('#table_hierarchy_loading').show();
      $('#table_hierarchy_result_container').fadeOut();
    } else {
      $('#table_hierarchy_result_container').fadeIn();
      $('#table_hierarchy_loading').hide();
    }
  }
  api.getTableHierarchy = getTableHierarchy;

  return api;

})();

/*************************************
              INIT
**************************************/

$(function () {

  // update the selector for the frames
  (function () {
    if (window.opener) {
      var frames = window.opener.frames;
      var target = $('#target');
      target.append('<option value="opener">Opener</option>');
      for (var i = 0; frames.length > i; i++) {
        if (!frames[i].name) continue;
        target.append('<option value="frame_' + i + '">Opener: ' + frames[i].name + '</option>');
      }
    }
  })();

  // Populate the scope selector
  $(function () {
    var $scope = $('#scope');
    $scope.empty();
    $scope.append($('<option class="text-italic text-muted">Loading</option>'));

    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getScopes',
      dataType: 'json'
    }).
    done(function (result) {
        $scope.empty();
        $.each(result, function (i, item) {
          $scope.append($('<option value="' + item.scope + '">' + item.name + '</option>'));
        });
    }).
    fail(function () {
      snd_log('Error: populateScopes failed.');
    });
  });

  window.snd_xplore_editor = CodeMirror.fromTextArea(document.getElementById("snd_xplore"), {
    lineNumbers: true,
    lineWrapping: true,
    tabSize: 2,
    indentUnit: 2,
    smartIndent: true,
    matchBrackets: true,
    mode: 'javascript'
  });

  var sxr = snd_xplore_reporter;
  sxr.initialize();
  sxr.addEvent('start', snd_xplore_util.loading);
  sxr.addEvent('done', snd_xplore_util.loadingComplete);
  sxr.addEvent('click.interactive-result', snd_xplore_util.execute);
  sxr.addEvent('click.breadcrumb', snd_xplore_util.execute);


  // handle the run button clicking
  $('#xplore_btn').click(function () {
    snd_xplore_util.executeNew();
  });

  // handle the cancel button clicking
  $('#cancel_btn').click(function () {
    snd_xplore_util.cancel();
  });

  // Setup property toggles
  $('#show_props,#show_strings').bootstrapToggle({
    on: 'Show',
    off: 'Hide',
    size: 'mini',
    onstyle: 'success',
    offstyle: 'danger',
    width: 75
  });
  $('#show_html_messages').bootstrapToggle({
    on: 'HTML',
    off: 'Text',
    onstyle: 'default',
    offstyle: 'default',
    size: 'mini',
    width: 75
  });

  // regex input trigger
  $('#regex,#regex_options,#regex_input').on('keyup', function () {
    delay('testRegex', snd_xplore_regex_util.run, 700);
  });

  // table input trigger
  $('#table_hierarchy_form').on('submit', function (e) {
    e.preventDefault();
    var table = $('#table_hierarchy_table').val();
    var search_labels = $('#table_hierarchy_table_do_label').is(':checked');
    //if (!table) return;
    //delay('tableHierarchy', function () {
      snd_xplore_table_util.getTableHierarchy(table, search_labels);
    //}, 700);
  });

  // table hierarchy link trigger
  $('#table_hierarchy_result').on('click', 'a', function (e) {
    var $this = $(this);
    var table;
    table = $this.attr('data-show');
    if (table) {
      e.preventDefault();
      $('#table_hierarchy_table').val(table);
      snd_xplore_table_util.getTableHierarchy(table);
    }
  });

  // setup the side pane controls
  $('#side_controls li').on('click', 'a', function () {
    var $target = $(this);
    if (!$target.attr('data-pane')) return;

    $('#side_controls li a').each(function () {
      var $this = $(this);
      var pane = $this.attr('data-pane');
      if (!pane) return;
      var $pane = $('#' + pane);

      if (this === $target.get(0)) {
        var workbenchLeft = $('#side_controls').outerWidth();
        if (!$pane.is(':visible')) {
          workbenchLeft += $pane.outerWidth();
          $('#workbench').animate({left: workbenchLeft}, 400, function () {
            $pane.fadeIn(400);
            resizeOutputContent();
          });
        } else {
          $pane.fadeOut(400, function () {
            $('#workbench').animate({left: workbenchLeft}, 400, function () {
              $('#workbench').css('left', '');
              resizeOutputContent()
            });
          });
        }
        $this.toggleClass('active');
      } else {
        $this.removeClass('active');
        $pane.hide();
      }
    });
  });

  // setup the editor toggle button
  $('#editor_toggle').on('click', function () {
    snd_xplore_util.toggleEditor();
  });

  // Execute the script again when the breadcrumb is reset
  $('#clearBreadcrumb').on('click', function () {
    snd_xplore_util.executeNew();
  });

  // execute when Ctrl + Enter is used
  $('#editor').keydown(function (event) {
    if (event.ctrlKey) {
      if (event.keyCode == 10 || event.keyCode == 13) {
        event.preventDefault();
        snd_xplore_util.executeNew();
      }
    }
  });

  var resizeUtil = {
    calcEditorRatio: function (store) {
      var ratio = $('#editor').width() / $('#workbench').width();
      if (store) {
        resizeUtil.editorRatio = ratio;
      }
      return ratio;
    },
    editorRatio: 0,

    calcWorkbenchWidth: function (store) {
      var width = $('#workbench').width();
      if (store) {
        resizeUtil.workbenchWidth = width;
      }
      return width;
    },
    workbenchWidth: 0
  };
  resizeUtil.calcEditorRatio(true);
  resizeUtil.calcWorkbenchWidth(true);

  // make the code mirror editor resizable
  $('#editor').resizable({
    containment: 'parent',
    handles: {'e': '.ui-resizable-e'},
    minWidth: 100,
    resize: function (e, ui) {
       $('#output').css('left', ui.size.width + 'px');
       resizeUtil.calcEditorRatio(true);
    }
  });

  // set the width of the editor and output so they are pixels instead of percents
  // this is so the editor looks right when the side-pane is shown/hidden
  (function () {
    var $output = $('#output');
    var $editor = $('#editor');
    var editorWidth = $editor.outerWidth();
    $output.css('left', editorWidth);
    $editor.css('width', editorWidth);
  })();

  // Setup the onChange handler for hiding scope select
  // when the target is not the client.
  $('#target').on('change', function () {
    if (this.value == 'server') {
      $('#scope').fadeIn();
    } else {
      $('#scope').fadeOut();
    }
  });

  // make tabs clickable
  $('#output_tabs a').click(function (e) {
    e.preventDefault();
    $(this).tab('show');
  });

  // make system log iframe load on tab click
  $('#system_log_tab').one('click', function () {
    $('#system_log_frame').attr('src', '/syslog_list.do?sysparm_query=sys_created_onONToday%40javascript%3Ags.daysAgoStart(0)%40javascript%3Ags.daysAgoEnd(0)');

    // now make it reload every time the tab is double clicked
    $('#system_log_tab').dblclick(function () {
      var $frame = $('#system_log_frame');
      $frame.attr('src', $frame.attr('src'));
    });

  });

  $output_tabs_pane = $('#output_tabs_pane');

  // facilitate system log frame resizing
  function resizeLogPane() {
    var $output_content = $('#output_content');
    var $output_tabs = $('#output_tabs');
    var $el = $('#system_log_frame');
    $el.css('height', $output_content.height() - $output_tabs.height() - 10);
  }
  resizeLogPane();

  // update the output pane so the tabs can stack and be seen
  function resizeOutputContent() {
    $output_tabs_pane.css('top', $('#output_tabs').outerHeight() + 'px');
  }
  resizeOutputContent();

  function resizeUserData() {
    var $user_data_pane = $('#user_data_pane');
    var user_data_input = $('#user_data_input').get(0);
    var remaining_space;

    user_data_input.style.height = '';
    remaining_space = $output_tabs_pane.height() - $user_data_pane.height();

    if (remaining_space > 10) {
      user_data_input.style.height = (remaining_space - 10) + 'px';
    }
  }
  resizeUserData();

  // resize the view when the window resizes
  $(window).resize(function () {
    // need to see if we are changing the window size or just the editor width
    // we do this by checking if the workbench width has changed
    if (resizeUtil.workbenchWidth != resizeUtil.calcWorkbenchWidth(true)) {
      var newWidth = $('#workbench').width() * resizeUtil.editorRatio;
      var $editor = $('#editor');
      $editor.css('width', newWidth);
      if ($editor.is(':visible')) {
        $('#output').css('left', newWidth);
      }
    }

    resizeLogPane();
    resizeOutputContent();
    resizeUserData();
  });

  snd_xplore_editor.focus();
  $('#window_loader').removeClass('active');
});
