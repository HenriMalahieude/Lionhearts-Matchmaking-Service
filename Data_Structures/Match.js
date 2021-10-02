const uuid = require('uuid');   
class Match{
    //Internal Data
    Status = 'Pending';
    Type; //used to match filters
    Requisitioned = false; //If Roblox has requested for the information

    //Data to be sent outwards
    Guid; //generated/global unique identification
    ParentJobId = '';
    FoundAt;
    AssociatedPlayers = []; //Format: {Player = ..., Accepted = ...}
    PlaceId;
    PrivateServerId = '';
    AccessCode = '';
    MapId;


    constructor(Type, ParentJobId, associatedPlayers, MapId){
        this.Type = Type;
        this.Guid = uuid.v4();
        this.ParentJobId = ParentJobId;
        this.FoundAt = Date.now();

        for (var User of associatedPlayers){ //add them all the match list
            if (User){
                User.AcceptState(false);
                this.AssociatedPlayers.push(User);
            }else{
                console.log('Tried to add a nil user to a match? Failing the Match')
                this.manualFail();
            }
        }

        this.MapId = MapId;
    }

    //Getters
    get Status(){
        return this.Status;
    }

    get Guid(){
        return this.Guid;
    }

    get ParentJobId(){
        return this.ParentJobId;
    }

    get Type(){
        return this.Type;
    }

    get AssociatedPlayers(){
        return this.AssociatedPlayers;
    }

    get FoundAt(){
        return this.FoundAt;
    }

    get PrivateServerId(){
        return this.PrivateServerId;
    }

    get Requisitioned(){
        return this.Requisitioned;
    }

    checkConfirmation(){
        //console.log('Checking Confirmation on a ' + this.Status + ' match')
        let self = this
        function allConfirmed(){
            for (var user of self.AssociatedPlayers){
                if (user.Accepted == false){
                    return false;
                }
            }

            return true;
        }

        if (this.Status == 'Pending'){
            //console.log('Detected a pending match')
            if (Date.now() - this.FoundAt >= 20000){ //fail any match that takes longer than 20 seconds to confirm
                //console.log('This match has taken much to long to get confirmed. Trying to fail it?')
                if (!allConfirmed()){
                    this.manualFail();
                    return;
                }

                this.setStatus('Confirmed');
                return;
            }else{
                if (allConfirmed()){
                    this.setStatus('Confirmed');
                    return;
                }
                return;
            }
        }

        return;
    }

    requiredByRoblox(){ //recieved by roblox
        this.Requisitioned = true
    }
    
    toArray(){
        let processedBody = {
            'Guid': this.Guid,
            'ParentJobId': this.ParentJobId,
            'FoundAt': this.FoundAt,
            'PlaceId': this.PlaceId,
            'PrivateServerId': this.PrivateServerId,
            'AccessCode': this.AccessCode,
            'MapId': this.MapId,
            'Parameters' : this.Type,
            'Teams': [
                [],
                []
            ]
        }

        for (var user of this.AssociatedPlayers){ //will need to be changed for when parties are a thing
            if (processedBody.Teams[0].length < (this.AssociatedPlayers.length/2)){
                processedBody.Teams[0].push(user.toArray())
            }else{
                processedBody.Teams[1].push(user.toArray())
            }
        }

        return processedBody
    }

    userConfirmed(userId){
        for (var user of this.AssociatedPlayers){
            if (user.UserId == userId){
                user.AcceptState(true)
                this.checkConfirmation()
                return;
            }
        }
    }

    reservedServerInformation(info){
        if (this.Status == 'Confirmed'){
            this.PlaceId = info.PlaceId;
            this.PrivateServerId = info.PrivateServerId;
            this.AccessCode = info.AccessCode
        }
    }

    setStatus(text){
        this.FoundAt = Date.now()
        this.Status = text;
    }

    manualFail(){
        this.setStatus('Failed')
    }
}

module.exports = Match