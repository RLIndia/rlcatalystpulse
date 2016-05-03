
/*
 Copyright [2016] [Relevance Lab]

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var logger = require('_pr/logger')(module);
var nexus = require('../lib/nexus.js');
var masterUtil = require('_pr/lib/utils/masterUtil.js');
var appDeploy = require('_pr/model/app-deploy/app-deploy');
var deployPermission = require('_pr/model/app-deploy/deploy-permission');
var async = require("async");
var apiUtil = require('_pr/lib/utils/apiUtil.js');

const errorType = 'appDeploy';

var appDeployService = module.exports = {};

appDeployService.getNexusRepositoryList = function getNexusRepositoryList(nexusId,projectId, callback) {
    nexus.getNexusRepositories(nexusId,function(err,repositories){
        if(err){
            logger.debug("Failed to fetch  Nexus Repository");
            callback(err,null);
            return;
        }
        if(repositories.length === 0){
            logger.debug("There is no Nexus Server configured.");
            callback(null,[]);
            return;
        }
        else{
            repositories = JSON.parse(repositories);
            var repoData=repositories.repositories.data['repositories-item'];
            masterUtil.getParticularProject(projectId, function(err, aProject) {
                if (err) {
                    logger.debug("Failed to fetch  Project");
                    callback(err,null);
                    return;
                }
                if (aProject.length === 0) {
                    logger.debug("There is no Project configured.");
                    callback(null,[]);
                    return;
                }
                else{
                    var nexusRepositories = [];
                    var aNexusRepo={};
                    if (aProject[0].repositories) {
                        var repositories = aProject[0].repositories.nexus;
                        if (repositories.length) {
                            for (var x = 0; x < repositories.length; x++) {
                                for (var i = 0; i < repoData.length; i++) {
                                    if (repositories[x] === repoData[i].name) {
                                        aNexusRepo['name'] = repoData[i].name;
                                        aNexusRepo['resourceURI'] = repoData[i].resourceURI;
                                        aNexusRepo['id'] = repoData[i].id;
                                    }
                                }
                                nexusRepositories.push(aNexusRepo);
                                aNexusRepo={};
                            }
                        }
                        callback(null, nexusRepositories);
                        return;
                    }
                }

            });
        }
    });
};
appDeployService.getNexusArtifactList=function getNexusArtifactList(nexusId,repoName,groupId,callback){
    nexus.getNexusArtifact(nexusId,repoName,groupId,function(err,artifacts){
        if(err){
            logger.debug("Error while fetching nexus artifact.");
            callback(err,null);
            return;
        }
        if(artifacts.length === 0){
            logger.debug("There is no Nexus Server Artifacts configured.");
            callback(null,[]);
            return;
        }
        else{
            var repoList = [];
            var uniqueArtifacts = [];
            var checker;
            for (var i = 0; i < artifacts.length; i++) {
                (function(aArtifact) {
                    var repoObj = {};
                    repoObj['resourceURI'] = artifacts[i].resourceURI;
                    repoObj['version'] = artifacts[i].version;
                    repoObj['artifactId'] = artifacts[i].artifactId;
                    repoList.push(repoObj);
                    if (!checker || compareObject(checker, aArtifact) != 0) {
                        checker = aArtifact;
                        uniqueArtifacts.push(checker);
                    }
                })(artifacts[i]);
            }
            callback(null,uniqueArtifacts);
        }
    });
};

function compareObject(a, b) {
    if (a.artifactId === b.artifactId) {
        return 0;
    } else {
        return 1;
    }
};
appDeployService.getAppDeployListByProjectId=function getAppDeployListByProjectId(jsonData,callback){
    masterUtil.getParticularProject(jsonData.projectId, function(err, aProject) {
        if (err) {
            logger.debug("Failed to fetch  Project");
            callback(err, null);
            return;
        }
        if (aProject.length === 0) {
            logger.debug("There is no Project configured.");
            callback(null, []);
            return;
        } else {
            appDeploy.getDistinctAppDeployApplicationNameByProjectId(jsonData, function (err, distinctAppDeployApplicationNames) {
                if (err) {
                    logger.debug("Failed to fetch App Deploy Versions");
                    callback(err, null);
                    return;
                }
                var appDeployList = [];
                var aAppDeployObj = {};
                var environments = aProject[0].environmentname.split(",");
                var applicationNames=distinctAppDeployApplicationNames.applicationNames;
                if (applicationNames.length > 0) {
                    for(var i = 0; i < applicationNames.length;i++){
                        (function(AppName){
                            jsonData['appName']=AppName._id;
                            appDeploy.getDistinctAppDeployVersionByProjectId(jsonData, function (err, appDeployVersions) {
                                if (err) {
                                    logger.debug("Failed to fetch App Deploy Versions");
                                    callback(err, null);
                                    return;
                                }
                                if (appDeployVersions.length === 0) {
                                    logger.debug("There is no App Deploy Versions configured.");
                                    callback(null, []);
                                    return;
                                }
                                else {

                                    for (var  j = 0; j < appDeployVersions.length; j++) {
                                        (function (aVersion) {
                                            appDeploy.getLatestAppDeployListByProjectIdAppNameVersionId(jsonData.projectId,AppName._id, aVersion._id, function (err, appDeploys) {
                                                if (err) {
                                                    logger.debug("Failed to fetch App Deploy");
                                                    callback(err, null);
                                                    return;
                                                }
                                                if (appDeploys.length === 0) {
                                                    logger.debug("There is no App Deploy configured.");
                                                    callback(null, []);
                                                    return;
                                                }
                                                aAppDeployObj['appName'] = {
                                                    "name": appDeploys[0].applicationName,
                                                    "version": appDeploys[0].applicationVersion
                                                };
                                                for (var k = 0; k < appDeploys.length; k++) {
                                                    (function (aAppDeploy) {
                                                        aAppDeployObj[aAppDeploy.envName] = {
                                                            "applicationInstanceName": aAppDeploy.applicationInstanceName,
                                                            "applicationNodeIP": aAppDeploy.applicationNodeIP,
                                                            "applicationLastDeploy": aAppDeploy.lastAppDeployDate,
                                                            "applicationStatus": aAppDeploy.applicationStatus,
                                                            "applicationType": aAppDeploy.applicationType,
                                                            "containerId": aAppDeploy.containerId,
                                                            "hostName": aAppDeploy.hostName
                                                        }
                                                    })(appDeploys[k]);
                                                }
                                                for (var l = 0; l < environments.length; l++) {
                                                    if (!aAppDeployObj[environments[l]]) {
                                                        aAppDeployObj[environments[l]] = {};
                                                    }
                                                }
                                                appDeployList.push(aAppDeployObj);
                                                if (distinctAppDeployApplicationNames.pageSize === appDeployList.length) {
                                                    var response = {};
                                                    response[jsonData.id] = appDeployList;
                                                    response['metaData'] = {
                                                        totalRecords: distinctAppDeployApplicationNames.totalRecords,
                                                        pageSize: jsonData.pageSize,
                                                        page: jsonData.page,
                                                        totalPages: Math.ceil(distinctAppDeployApplicationNames.totalRecords / jsonData.pageSize),
                                                        sortBy: Object.keys(jsonData.sortBy)[0],
                                                        sortOrder: jsonData.sortBy ? (jsonData[Object.keys(jsonData.sortBy)] == 1 ? 'asc' : "desc") : '',
                                                    };
                                                    callback(null, response);
                                                }
                                                aAppDeployObj = {};
                                            });
                                        })(appDeployVersions[j]);
                                    }
                                }
                            });
                        })(applicationNames[i]);
                    }
                } else {
                    var response = {};
                    response[jsonData.id] = [];
                    response['metaData'] = {
                        totalRecords: 0,
                        pageSize: jsonData.pageSize,
                        page: jsonData.page,
                        totalPages: 0,
                        sortBy: Object.keys(jsonData.sortBy)[0],
                        sortOrder: jsonData.sortBy ? (jsonData[Object.keys(jsonData.sortBy)] == 1 ? 'asc' : "desc") : '',
                    };
                    logger.debug("There is no App Deploy Versions configured.");
                    callback(null, response);
                    return;
                }
            });
        }
    });

};

appDeployService.getAppDeployHistoryListByProjectIdEnvNameAppNameVersion=function getAppDeployHistoryListByProjectIdEnvNameAppNameVersion(projectId,envName,appName,version,callback){
    appDeploy.getAppDeployHistoryListByProjectIdEnvNameAppNameVersion(projectId,envName,appName,version,function(err,appDeployHistoryList){
        if(err){
            logger.debug("Error while fetching App Deploy History via projectId,envName,appName and appDeployVersion");
            callback(err,null);
            return;
        }
        if(appDeployHistoryList.length === 0){
            logger.debug("There is no App Deploy History via projectId,envName,appName and appDeployVersion configured.");
            callback(null,[]);
            return;
        }
        callback(null,appDeployHistoryList);
    })

};

appDeployService.getNexusArtifactVersionList=function getNexusArtifactVersionList(nexusId,repoName,groupId,artifactId,callback){
    nexus.getNexusArtifactVersions(nexusId,repoName,groupId,artifactId,function(err,versions){
        if(err){
            logger.debug("Error while fetching nexus artifact Version.");
            callback(err,null);
            return;
        }
        if(versions.length === 0){
            logger.debug("There is no Nexus Server Versions configured.");
            callback(null,[]);
            return;
        }
        callback(null,versions.metadata.versioning[0].versions[0].version);
    });
};

appDeployService.getAppDeployHistoryListByProjectId=function getAppDeployHistoryListByProjectId(jsonData,callback){
    jsonData['searchColumns'] = ['envId', 'applicationVersion'];
    apiUtil.databaseUtil(jsonData, function (err, databaseCall) {
        if (err) {
            var err = new Error('Internal server error');
            err.status = 500;
            return callback(err);
        }
        else {
            appDeploy.getAppDeployHistoryListByProjectId(databaseCall.queryObj, databaseCall.options, function (err, appDeployHistoryData) {
                if (err) {
                    var err = new Error('Internal server error');
                    err.status = 500;
                    return callback(err);
                }else {
                    return callback(null, appDeployHistoryData);
                }
            });
        }
    });
};

appDeployService.getPipeLineViewListByProjectId=function getPipeLineViewListByProjectId(jsonData,callback){
    masterUtil.getParticularProject(jsonData.projectId, function(err, aProject) {
        if (err) {
            logger.debug("Failed to fetch  Project");
            callback(err, null);
            return;
        }
        if (aProject.length === 0) {
            logger.debug("There is no Project configured.");
            callback(null, []);
            return;
        }else {
            appDeploy.getDistinctAppDeployApplicationNameByProjectId(jsonData, function (err, distinctAppDeployApplicationNames) {
                if (err) {
                    logger.debug("Failed to fetch App Deploy Versions");
                    callback(err, null);
                    return;
                }
                var pipeLineViewList = [];
                var aPipeLineViewObj = {};
                var environments = aProject[0].environmentname.split(",");
                var applicationNames=distinctAppDeployApplicationNames.applicationNames;
                if (applicationNames.length > 0) {
                    for(var i = 0; i < applicationNames.length;i++){
                        (function(AppName){
                            appDeploy.getPipeLineViewListByProjectIdAppName(jsonData.projectId,AppName._id,function (err, appDeploys) {
                                if (err) {
                                    logger.debug("Failed to fetch App Deploy");
                                    callback(err, null);
                                    return;
                                }
                                if (appDeploys.length === 0) {
                                    logger.debug("There is no App Deploy configured.");
                                    callback(null, []);
                                    return;
                                }
                                aPipeLineViewObj['appName'] = appDeploys[0].applicationName;
                                for (var k = 0; k < appDeploys.length; k++) {
                                    (function (aAppDeploy) {
                                        aPipeLineViewObj[aAppDeploy.envName] = {
                                            "version": aAppDeploy.applicationVersion,
                                            "instanceName": aAppDeploy.applicationInstanceName,
                                            "applicationLastDeploy": aAppDeploy.lastAppDeployDate,
                                            "applicationStatus": aAppDeploy.applicationStatus,
                                            "applicationType": aAppDeploy.applicationType,
                                            "containerId": aAppDeploy.containerId,
                                            "isApproved": aAppDeploy.isApproved
                                        }
                                    })(appDeploys[k]);
                                }
                                for (var l = 0; l < environments.length; l++) {
                                    if (!aPipeLineViewObj[environments[l]]) {
                                        aPipeLineViewObj[environments[l]] = {};
                                    }
                                }
                                pipeLineViewList.push(aPipeLineViewObj);
                                if (pipeLineViewList.length === distinctAppDeployApplicationNames.applicationNamesLength) {
                                    var response = {};
                                    response['pipeLineView'] = pipeLineViewList;
                                    response['metaData'] = {
                                        totalRecords: distinctAppDeployApplicationNames.totalRecords,
                                        pageSize: jsonData.pageSize,
                                        page: jsonData.page,
                                        totalPages: Math.ceil(distinctAppDeployApplicationNames.totalRecords / jsonData.pageSize),
                                        sortBy: Object.keys(jsonData.sortBy)[0],
                                        sortOrder: jsonData.sortBy ? (jsonData[Object.keys(jsonData.sortBy)] == 1 ? 'asc' : "desc") : '',
                                    };
                                    callback(null, response);
                                }
                                aPipeLineViewObj = {};
                            });
                        })(applicationNames[i]);
                    }
                }else {
                    var response = {};
                    response['pipeLineView'] = [];
                    response['metaData'] = {
                        totalRecords: 0,
                        pageSize: jsonData.pageSize,
                        page: jsonData.page,
                        totalPages: 0,
                        sortBy: Object.keys(jsonData.sortBy)[0],
                        sortOrder: jsonData.sortBy ? (jsonData[Object.keys(jsonData.sortBy)] == 1 ? 'asc' : "desc") : '',
                    };
                    logger.debug("There is no App Deploy Versions configured.");
                    callback(null, response);
                    return;
                }
            });
        }
    });

};





