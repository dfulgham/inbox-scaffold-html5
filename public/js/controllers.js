// Helpers

var _clone = function(obj) {
    return JSON.parse(JSON.stringify(obj));
};

var _displayErrors = true;
window.onbeforeunload = function () {
  _displayErrors = false;
};

var _handleAPIError = function(error) {
  if (!_displayErrors)
    return;
  var msg = "An unexpected error occurred. (HTTP code " + error['status'] + "). Please try again.";
  if (error['message'])
      msg = error['message'];
  alert(msg);
};

// Controllers

angular.module('baobab.controllers', ['inbox', 'ngSanitize', 'ngCookies']).

controller('AppCtrl', ['$scope', '$me', '$inbox', '$auth', '$location', '$cookieStore', '$sce', function($scope, $me, $inbox, $auth, $location, $cookieStore, $sce) {
  var self = this;
  window.AppCtrl = this;

  this.inboxAuthURL = $sce.trustAsResourceUrl('https://beta.inboxapp.com/oauth/authorize');
  this.inboxClientID = $inbox.appId();
  this.inboxRedirectURL = window.location.protocol + "//" + window.location.host + "/";
  this.loginHint = '';

  this.clearToken = $auth.clearToken;
  this.hasToken = function() {
    return !!$auth.token;
  }

  this.theme = $cookieStore.get('baobab_theme') || 'light';
  this.setTheme = function(theme) {
    self.theme = theme;
    $cookieStore.put('baobab_theme', theme);
  }

  this.cssForTab = function(path) {
    return ($location.path().indexOf(path) != -1) ? 'active' : '';
  }
}]).


controller('ComposeCtrl', ['$scope', '$namespace', function($scope, $namespace) {
  var self = this;
  this.statusMessage = "";

  if (!$scope.draft) {
    console.log("Creating new draft");
    $scope.draft = $namespace.draft();
  }

  this.disposeClicked = function() {
    $scope.draft.dispose();
  };

  this.saveClicked = function() {
    self.statusMessage = 'Saving...';
    $scope.draft.save();
    self.statusMessage = 'Saved.';
  };

  this.downloadAttachment = function(attachment) {
    $scope.draft.getAttachments().then(function(attachments) {
      for(i = 0; i < attachments.length; i++)
      {
        if(attachments[i].id == attachment.id)
          attachments[i].download().then(function(response) {
            saveAs(response.blob, response.filename);
          }, function(err) {
            console.log('error:' + err);
          });
      }
    }, _handleAPIError)
  };

  this.removeAttachment = function(attachment) {
    $scope.draft.removeAttachment(attachment);
  }

  this.attached = function() {
      var file_node = document.getElementById('upload');
      self.file = file_node.files[0];
      $scope.draft.uploadAttachment(self.file).then(function(in_file){
          self.statusMessage = '';
      }, function(err){
          console.log('error:' + err);
      }, function(){
        // progress??
      });
      self.statusMessage = 'uploading: ' + self.file.name;
  }

  this.attachClicked = function(file_node) {
    var self = this;
    var file_node = document.getElementById('upload');
    if(self.change_attached != true)
    {
      self.change_attached = true;
      $(file_node).on("change", this.attached);
    }
    file_node.click();
    return false;
  };

  this.sendClicked = function() {
    self.statusMessage = 'Saving...';
    $scope.draft.save().then(function() {
      self.statusMessage = 'Sending...';
      $scope.draft.send().then(function() {
        $scope.$hide();
      });
    });
  };

}]).

controller('ThreadCtrl', ['$scope', '$namespace', '$threads', '$modal', '$routeParams', '$location', function($scope, $namespace, $threads, $modal, $routeParams, $location) {
  var self = this;

  this.thread = $threads.item($routeParams['id']);
  this.messages = null;
  this.drafts = null;

  // internal methods

  if (this.thread) {
    threadReady();
  } else {
    $namespace.thread($routeParams['id']).then(function(thread) {
      self.thread = thread;
      threadReady();
    }, _handleAPIError);
  }


  function threadReady() {
    if (self.thread.hasTag('unread')) {
      self.thread.removeTags(['unread']).then(function(response) {
      }, _handleAPIError);
    }
    self.thread.messages().then(function(messages) {
      self.messages = messages;
    }, _handleAPIError);

    self.thread.drafts().then(function(drafts) {
      self.drafts = drafts;
    }, _handleAPIError);
  }

  // exposed methods

  this.downloadAttachment = function(msg, id) {
    msg.attachment(id).download().then(function(response) {
      saveAs(response.blob, response.filename);
    }, _handleAPIError);
  };

  this.composeClicked = function() {
  }

  this.replyClicked = function() {
    self.launchDraftModal(thread.reply());
  }

  this.archiveClicked = function() {
    self.thread.removeTags(['inbox']).then(function(response) {
      $threads.itemArchived(self.thread.id);
      $location.path('/inbox');
    }, _handleAPIError);
  }

}]).


controller('ThreadListCtrl', ['$scope', '$me', '$threads', '$modal', '$routeParams', function($scope, $me, $threads, $modal, $routeParams) {
  var self = this;

  $scope.search = $threads.filters()['any_email'] || '';
  $scope.$watch('search', function() {
    updateAutocomplete();
  })

  $threads.setFilters({tag: $routeParams['tag'] || 'inbox'});

  this.threads = $threads.list();
  this.viewName = $routeParams['tag'];
  this.autocomplete = [];
  this.autocompleteSelection = null;

  // internal methods

  function updateAutocomplete() {
    var contacts = $me.contacts();
    var term = $scope.search.toLowerCase();
    var results = []

    if (term.length == 0)
      return self.autocomplete = [];

    for (var ii = 0; ii < contacts.length; ii ++) {
      if ((contacts[ii].email.toLowerCase().indexOf(term) == 0) || (contacts[ii].name.toLowerCase().indexOf(term) == 0))
        results.push(contacts[ii]);
      if (results.length == 3)
        break;
    }
    self.autocomplete = results;
  }

  // exposed methods

  this.tokenizedFilters = function() {
    var filters = $threads.filters();
    delete filters['any_email'];
    return filters;
  }

  this.composeClicked = function() {
  }

  this.archiveClicked = function(thread) {
    thread.removeTags(['inbox']).then(function(response) {
      $threads.itemArchived(thread.id);
    }, _handleAPIError);
  }

  this.searchClicked = function() {
    var filters = {};
    var search = $scope.search;

    if (search.indexOf(':') > 0) {
      _.each(search.split(' '), function(term) {
        var parts = term.split(':');
        if (parts.length == 2) {
          filters[parts[0]] = parts[1];
          search = search.replace(term, '');
        }
      });

    } else {
      filters['any_email'] = search;
    }
    
    $threads.appendFilters(filters);
    $scope.search = search;

    self.autocomplete = [];
    self.autocompleteSelection = null;
  }

  this.searchCleared = function() {
    $scope.search = "";
    $threads.setFilters({});
  }

  this.selectThreadRelative = function(direction) {
    for(i = 0; i < self.threads.length; i++) {
      if(self.threads[i] == self.selectedThread) {
        if(i + direction < self.threads.length - 1 && i + direction > 0) {
          self.selectedThread = self.threads[i + direction];
          angular.element(selectedNode).removeClass('active');
          selectedNode = document.getElementById(self.selectedThread.id);
          angular.element(selectedNode).addClass('active');
          break;
        }
      }
    }
  }

  this.keypressInAutocomplete = function(e) {
    var index = self.autocomplete.indexOf(self.autocompleteSelection);

    if(e.keyCode == 40) {
      if (self.autocompleteSelection == null)
        self.autocompleteSelection = self.autocomplete[0]
      else {
        if (index == -1)
          self.autocompleteSelection = self.autocomplete[0]
        else if (index + 1 < self.autocomplete.length)
          self.autocompleteSelection = self.autocomplete[index+1];
      }
      e.preventDefault();
    }

    if(e.keyCode == 38) {
      if (index > 0) {
        self.autocompleteSelection = self.autocomplete[index-1];
      }
      e.preventDefault();
    }

    if (e.keyCode == 13) {
      if (self.autocompleteSelection)
        $scope.search = self.autocompleteSelection.email
      self.searchClicked();
    }

  }

  this.keypressCallback = function(e) {
    if(e.keyCode == 40)
      self.selectThreadRelative(1);
    if(e.keyCode == 38)
      self.selectThreadRelative(-1);
  }

  $threads.on('update', function() {
    self.threads = $threads.list();
  });

}]);

