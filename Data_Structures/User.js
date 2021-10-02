class User {
    UserId = 0;
    JobId = "";
    Accepted = false;
    MatchFilters;
    LastUpdate;
    JoinedAt;
    constructor(UserId, JobId, Filters){
        this.UserId = UserId;
        this.JobId = JobId;
        this.MatchFilters = Filters;
        this.LastUpdate = Date.now();
        this.JoinedAt = Date.now();
    }

    //Object Get
    get UserId(){
        return this.UserId;
    }

    get Origin(){
        return this.JobId;
    }

    get MatchFilters(){
        return this.MatchFilters;
    }

    get LastUpdate(){
        return this.LastUpdate;
    }

    get JoinedAt(){
        return this.JoinedAt;
    }

    get Accepted(){
        return this.Accepted
    }

    //Methods
    moveTo(jobId){
        this.JobId = jobId;
    }

    updateFilters(filters){
        this.MatchFilters = filters;
    }

    AcceptState(bool){
        this.Accepted = bool
    }

    refresh(){
        this.LastUpdate = Date.now();
    }

    toArray(){
        return {
            UserId: this.UserId,
            Accepted: this.Accepted,
        }
    }
}

module.exports = User