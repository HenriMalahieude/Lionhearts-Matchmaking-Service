const userClass = require('./Data_Structures/User.js')
const matchClass = require('./Data_Structures/Match.js')

const MaximumSkillVariance = 6 //in levels
const MinimumSkillVariance = 2 
const SkillVarianceScaleTime = 2 //in minutes

const RateVarianceScale = 150 //mmr points scaling over time
const RateVarianceXOffset = 2 //in minutes
const RateVarianceYOffset = 20 //minimum variance

const MaximumStatSpillOver = 50 //amount of saved instances before a 'reset' in statistics

function calculateSkillVariance(timeInSeconds){
    let timeInMinutes = timeInSeconds / 60
    
    let topFrac = MaximumSkillVariance * Math.pow(timeInMinutes, 3) + MinimumSkillVariance * SkillVarianceScaleTime
    let botFrac = Math.pow(timeInMinutes, 3) + SkillVarianceScaleTime
    
    return (topFrac / botFrac)
}

function calculateRateVariance(timeInSeconds){
    let timeInMinutes = timeInSeconds / 60
    
    return Math.log10(timeInMinutes + RateVarianceXOffset) * RateVarianceScale - RateVarianceYOffset
}

class Matchmaker{
    console_identifier = '';
    queue_stats = {
        'Average Match Time':{
            'Time': 0,
            'Players Served': 0,
        },
        'Average Queue Time': {
            'Time': 0,
            'Players Involved': 0,
        },
        'Players Added': 0
    }
    user_queue = []
    matches = []

    constructor(identifier){
        this.console_identifier = identifier;
    }

    //Stats Calculator
    calcNewAvg(newValue, oldAvg, oldAm){
        let sum1 = oldAvg * oldAm
        let sum2 = sum1 + newValue
        let nAvg = sum2 / (oldAm+1)
        
        return nAvg
    }

    newQueueTime(playersTime){
        let tim2 = this.queue_stats['Average Queue Time']['Time']
        let n = this.queue_stats['Average Queue Time']['Players Involved']

        this.queue_stats['Average Queue Time']['Time'] = this.calcNewAvg((playersTime / 1000), tim2, n)
        this.queue_stats['Average Queue Time']['Players Involved'] += 1
    }

    newMatchTime(playersTime){
        let tim2 = this.queue_stats['Average Match Time']['Time']
        let n = this.queue_stats['Average Match Time']['Players Served']

        this.queue_stats['Average Match Time']['Time'] = this.calcNewAvg((playersTime / 1000), tim2, n)
        this.queue_stats['Average Match Time']['Players Served'] += 1
    }

    clearStats(){
        let n1 = this.queue_stats['Average Match Time']['Players Served']
        if (n1 > MaximumStatSpillOver){
            this.queue_stats['Average Match Time']['Players Served'] = 0
            this.queue_stats['Average Match Time']['Time'] = 0
        }

        let n2 = this.queue_stats['Average Queue Time']['Players Involved']
        if (n2 > MaximumStatSpillOver){
            this.queue_stats['Average Queue Time']['Players Involved'] = 0
            this.queue_stats['Average Queue Time']['Time'] = 0
        }
    }

    processQueue() {
        //console.log('\n' + this.console_identifier + ' Queue Loop!')
        
        this.clearStats()
        //if (this.console_identifier == 'Live'){
        //    console.log('--Users in ' + this.console_identifier + ' queue: ' + this.user_queue.length)
        //}
        //console.log('--Matches: ' + this.matches.length)
        const self = this

        function returnUsers(matchIndex){ //back to the queue
            let match = self.matches.splice(matchIndex, 1)[0]

            for (var user of match.AssociatedPlayers){
                self.newMatchTime(Date.now() - user.JoinedAt)
                if (user.Accepted){
                    self.user_queue.push(user);
                }
            }

            match = null;
        }

        //Check all existing Matches
        for (var index in self.matches){
            let match = self.matches[index]
            match.checkConfirmation();
            if (match.Status == 'Confirmed'){
                if ((Date.now() - match.FoundAt) > 30000 && match.Requisitioned){
                    match = self.matches.splice(index, 1)[0];

                    for (var user of match.AssociatedPlayers){
                        self.newMatchTime((Date.now() - user.JoinedAt))
                    }

                    match = null;
                }
            }else if (match.Status == 'Failed'){ //Any 'Failed' Matches will be removed, and will return users to the queue
                returnUsers(index); 
            }
        }

        //All users that haven't been updated in the past 10 seconds are deleted/removed
        for (var index in self.user_queue){
            if (Date.now() - self.user_queue[index].LastUpdate > 10000){
                var user = self.user_queue.splice(index, 1)[0]

                self.newQueueTime((Date.now() - user.JoinedAt))

                user = null;
            }
        }

        //Create new matches
        //TODO: Designing matches for quick play members
        let primaryUserIndex = 0 //current user we are designing a match for
        while (primaryUserIndex < self.user_queue.length && self.user_queue.length > 1){
            let primaryUserFilters = self.user_queue[primaryUserIndex].MatchFilters
            let similarIndices = [] //other players looking for a similar game

            //If self user has 'MatchSize' = 0 parameter, they are on QuickPlay so we can't create a match for designed around them (TODO: move them to a default 3v3 probably, but not rn)
            if (primaryUserFilters.MatchSize == 0){
                primaryUserIndex++;
                continue;
            }

            //Check for other players that want to play the same game
            for (var userIndex in self.user_queue){ //match undefined and same parameters/filters for games
                if (userIndex == primaryUserIndex){
                    continue; //skip same player
                }

                let userFilters = self.user_queue[userIndex].MatchFilters

                let matching = 0 //the number of matching parameters
                for (const [pModif, pSetting] of Object.entries(primaryUserFilters)){
                    //Any nil/undefined or 'quickplay' modifiers
                    if (userFilters[pModif] == undefined || (pModif == 'MatchSize' && userFilters[pModif] == 0) || (pModif == 'MapId' && userFilters[pModif] == 0)){
                        matching++;
                        continue;
                    }

                    //Skill Look
                    function ELO_MMR_LEVEL_MasterClass(skillDiff, type){ //takes a function as second parameter
                        let primaryVariance = type((Date.now() - self.user_queue[primaryUserIndex].JoinedAt) / 1000)
                        let secondaryVariance = type((Date.now() - self.user_queue[userIndex].JoinedAt) / 1000)
                        if (skillDiff < primaryVariance && skillDiff < secondaryVariance){
                            matching++;
                            return true;
                        }
                        return false;
                    }

                    //Combat Level
                    if (pModif == 'CombatExperience'){
                        let val = ELO_MMR_LEVEL_MasterClass(Math.abs(primaryUserFilters[pModif] - userFilters[pModif]), calculateSkillVariance)
                        if (val) continue;
                    }else if (pModif == 'MMR'){
                        let val = ELO_MMR_LEVEL_MasterClass(Math.abs(primaryUserFilters[pModif] - userFilters[pModif]), calculateRateVariance)
                        if (val) continue;
                    }

                    let prevMatching = matching
                    for (const [sModif, sSetting] of Object.entries(userFilters)){
                        if (pModif == sModif){
                            if (sSetting == pSetting){
                                matching++;
                            }
                            break;
                        }
                    }
                    if ((prevMatching+1) > matching){ //if the/any parameter was not found as matching, then no need to check the rest. They are not searching for the same match
                        break;
                    }
                }

                if (matching >= Object.keys(primaryUserFilters).length && matching >= Object.keys(userFilters).length){ //if they have the same number of matching parameters as primary keys, then add them to similar
                    similarIndices.push(userIndex); //add user to similar indices
                }
            }

            if ((similarIndices.length+1) >= primaryUserFilters.MatchSize){ //if we have more than enough matching players
                //Ensure that no player is actually nil/undefined
                let nilUser = false
                for (var index in similarIndices){
                    if (!self.user_queue[index]){
                        console.log('There was an undefined user?')
                        nilUser = true
                        break;
                    }
                }

                if (!nilUser){
                    let associatedPlayers = [self.user_queue.splice(primaryUserIndex, 1)[0]]; //add the primary player to the list
                    let indicesRemovedFromQueue = []

                    //Add players to the match
                    for (var index of similarIndices){
                        if (associatedPlayers.length < primaryUserFilters.MatchSize){
                            let similar_Index = index
                            if (index > primaryUserIndex){
                                similar_Index = index - 1
                            }//NOTE: This is hyper-important, because you are already removing one user, so if they are ahead in queue, they could be skipped

                            if (self.user_queue[similar_Index]){
                                associatedPlayers.push(self.user_queue[similar_Index])
                                indicesRemovedFromQueue.push(similar_Index)
                            }
                        }
                    }

                    //Remove player from queue
                    for (var index of indicesRemovedFromQueue){
                        self.user_queue.splice(index, 1)
                        for (var i in indicesRemovedFromQueue){
                            if (indicesRemovedFromQueue[i] == index) continue;
                            if (indicesRemovedFromQueue[i] > index){
                                indicesRemovedFromQueue[i] -= 1
                            }
                        }
                    } //I just want to note, that this was the final part of a multi-series bug solving escapade. God that was annoying

                    self.matches.push(new matchClass(primaryUserFilters, associatedPlayers[0].Origin, associatedPlayers, primaryUserFilters.MapId))
                    primaryUserIndex = 0;
                }
            }else{
                primaryUserIndex++; //if we can't find enough players for the user, then move on to the next index (TODO: moving onto an index NOT in the 'similarIndices' table)
            }
        }
    }

    addUser(UserArray, JobId){
        if (UserArray.Params.MatchSize == undefined){ 
            console.warn('Attempted to add a user who was missing the MatchSize filter'); 
            return;
        } //They MUST have a match size

        function compareUsers(userObj){
            if (userObj.UserId == UserArray.UserId){
                userObj.refresh();
                userObj.updateFilters(UserArray.Params);

                if (userObj.Origin != JobId){
                    userObj.moveTo(JobId)
                }
                
                return true
            }
            return false
        }

        //Checking if we don't already have this user
        let exists = false
        for (var userObj of this.user_queue){ //comparing queue
            if (compareUsers(userObj)){
                exists = true
                break;
            }
        }

        if (!exists){ //comparing match teams
            for (var match of this.matches){
                for (var userObj of match.AssociatedPlayers){
                    if (compareUsers(userObj)){
                        exists = true
                        break;
                    }
                }
                if (exists){
                    break;
                }
            }
        }

        if (!exists){
            this.queue_stats['Players Added']++;
            let user = new userClass(UserArray.UserId, JobId, UserArray.Params)
            this.user_queue.push(user)
        }
    }

    userConfirmed(userId){
        for (var match of this.matches){
            match.userConfirmed(userId)
        }
    }

    matchInfoCreated(information){
        for (var match of this.matches){
            if (match.Guid == information.Guid){
                match.reservedServerInformation(information)
                return;
            }
        }
    }

    getMatchFromPrivateServerId(privateServerId){
        for (var match of this.matches){
            if (match.PrivateServerId == privateServerId){
                return match;
            }
        }
        console.warn('With ' + this.matches.length + ' in the memory, we were unable to find a corresponding match for ' + privateServerId)
        return;
    }

    updateQueueResponse(){
        let info = {
            PendingMatches: [],
            ConfirmedMatches: [],
            Queue_Stats: {
                AverageQueue: Math.floor(this.queue_stats['Average Queue Time']['Time']),
                AverageMatch: Math.floor(this.queue_stats['Average Match Time']['Time']),
                PlayersJoined: this.queue_stats['Players Added'],
                UsersInQueue: this.user_queue.length,
                MatchesInMemory: this.matches.length
            },
        }

        for (var match of this.matches){
            if (match.Status == 'Pending'){
                info.PendingMatches.push(match.toArray())
            }else if(match.Status == 'Confirmed'){
                info.ConfirmedMatches.push(match.toArray())
            }
        }

        return info
    }
}

module.exports = Matchmaker;