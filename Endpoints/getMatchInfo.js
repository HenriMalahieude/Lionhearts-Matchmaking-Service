module.exports = {
    fire(query, matchmaker){
        let PrivateServerId = query.privateServerId

        if (PrivateServerId != undefined){
            let match = matchmaker.getMatchFromPrivateServerId(PrivateServerId)
            if (match != undefined){
                match.requiredByRoblox()
                return JSON.stringify(match.toArray())
            }else{
                console.warn('GetMatchInfo was requesting a non-existent match.')
                return;
            }
        }else{
            console.warn('Issues with getting a query for GetMatchInfo')
            return;
        }
    }
}