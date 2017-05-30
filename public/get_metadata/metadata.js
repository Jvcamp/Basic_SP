<script>
	var app = angular.module("getMetadata",[]);
	
	app.controller("metadataController", function($scope){
		$scope.getMetadata = function(){
			$http({
				method: 'GET'
				url: $scope.metadata_url
			}).then(function succesCallBack(response){
				$scope.metadata.push("success!")
			},function errorCallBack(response){
				$scope.metadata.push("fail!")
			}
		}
	}
</script>