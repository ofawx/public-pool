import { ClientStatisticsService } from '../ORM/client-statistics/client-statistics.service';
import { ClientEntity } from '../ORM/client/client.entity';

const CACHE_SIZE = 30;
const TARGET_SUBMISSION_PER_SECOND = 30;
export class StratumV1ClientStatistics {

    private submissionCacheStart: Date;
    private submissionCache = [];

    constructor(private readonly clientStatisticsService: ClientStatisticsService) {
        this.submissionCacheStart = new Date();
    }

    public async addSubmission(client: ClientEntity, targetDifficulty: number) {

        if (this.submissionCache.length > CACHE_SIZE) {
            this.submissionCache.shift();
        }

        this.submissionCache.push({
            time: new Date(),
            difficulty: targetDifficulty,
        });

        await this.clientStatisticsService.save({
            time: new Date(),
            difficulty: targetDifficulty,
            address: client.address,
            clientName: client.clientName,
            sessionId: client.sessionId,
        });

    }

    public getSuggestedDifficulty(clientDifficulty: number) {

        // miner hasn't submitted shares in one minute
        if (this.submissionCache.length == 0 && (new Date().getTime() - this.submissionCacheStart.getTime()) / 1000 > 60) {
            return this.blpo2(clientDifficulty >> 1);
        }

        if (this.submissionCache.length < CACHE_SIZE) {
            return null;
        }

        const sum = this.submissionCache.reduce((pre, cur) => {
            pre += cur.difficulty;
            return pre;
        }, 0);
        const diffSeconds = (this.submissionCache[this.submissionCache.length - 1].time.getTime() - this.submissionCache[0].time.getTime()) / 1000;

        const difficultyPerSecond = sum / diffSeconds;

        const targetDifficulty = difficultyPerSecond * TARGET_SUBMISSION_PER_SECOND;

        if (clientDifficulty << 1 < targetDifficulty || clientDifficulty >> 1 > targetDifficulty) {
            return this.blpo2(targetDifficulty)
        }

        return null;


    }

    private blpo2(x) {
        x = x | (x >> 1);
        x = x | (x >> 2);
        x = x | (x >> 4);
        x = x | (x >> 8);
        x = x | (x >> 16);
        x = x | (x >> 32);
        return x - (x >> 1);
    }


}