(function() {
  define(['angular', 'scribe'], function(angular, Scribe) {
    return angular.module('baobab.directive.scribe', []).directive('scribe', function() {
      return {
        require: 'ngModel',
        link: function(scope, elem, attr, model) {
          var safeApply, scribe;
          window.Scribe = Scribe;
          scribe = new Scribe(elem[0]);
          safeApply = function(fn) {
            if (scope.$$phase || scope.$root.$$phase) {
              return fn();
            } else {
              return scope.$apply(fn);
            }
          };
          model.$render = function() {
            return scribe.setContent(model.$viewValue || "");
          };
          model.$isEmpty = function(value) {
            return !value || scribe.allowsBlockElements() && value === '<p><br></p>';
          };
          return scribe.on("content-changed", function() {
            var value;
            value = scribe.getContent();
            return safeApply(function() {
              return model.$setViewValue(value);
            });
          });
        }
      };
    });
  });

}).call(this);