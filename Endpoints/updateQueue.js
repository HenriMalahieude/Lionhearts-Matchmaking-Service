module.exports = {
    fire(jsonRequest, matchmaker){
        //Ensure data
        let serverJobId = jsonRequest.JobId
        let userQueued = jsonRequest.UserQueue
        let reservedServers = jsonRequest.ReservedServers

        if (serverJobId != undefined && userQueued != undefined && reservedServers != undefined){
            //Add Users to Queue
            for (let user of userQueued){
                if (user.Params.MatchSize != undefined && user.Params.MapId != undefined){ //ensure they have a matchsize and MapId
                    if (user.Accepted){
                        matchmaker.userConfirmed(user.UserId);
                    }else{
                        matchmaker.addUser(user, serverJobId);
                    }
                }else{
                    console.warn('User' + user.UserId + ' was missing MatchSize and/or MapId parameter from ' + serverJobId)
                }
            }

            //Give a Match it's information
            for (let serverInfo of reservedServers){
                matchmaker.matchInfoCreated(serverInfo);
            }

            //Create response JSON
            return JSON.stringify(matchmaker.updateQueueResponse());
        }else{
            console.warn('Updating Queue was missing a server job id, a user list, and/or reserved server list.')
            return;
        }

    }
}