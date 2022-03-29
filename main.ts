import { PublicKey, Connection, Cluster } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";
import * as dotenv from "dotenv";
import {FEEDS} from "./feeds";
import {CloudWatchClient} from "./cloudWatchClient"; // should be loaded upon entry
dotenv.config();

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const cloudWatchClient = new CloudWatchClient('eu-west-1');
cloudWatchClient.logLeaseRunningOut();

const pageThreshold: number = +process.env.PAGE_THRESHOLD!;
async function main() {
  const feeds = await getFeeds();
  while (true) {
    for (const {feed, leaseAccount} of feeds) {
      const balance = await leaseAccount.getBalance();
      console.log(`${feed} balance ${balance}`);
      if (balance < pageThreshold) {
        cloudWatchClient.logLeaseRunningOut();
      }
    }
    await sleep(10 * 60 * 1000);
  }
}

type FeedsList = {feed: PublicKey, leaseAccount: sbv2.LeaseAccount}[];
async function getFeeds() : Promise<FeedsList> {
    const program = await getProgram(process.env.CLUSTER! as Cluster);
    const feeds : FeedsList = [];
    for (const feed of FEEDS) {
      const feedPublicKey = new PublicKey(feed);
      const aggregatorAccount = new sbv2.AggregatorAccount({
        program,
        publicKey: feedPublicKey,
      });
      const aggregator = await aggregatorAccount.loadData();
      const queueKey = aggregator.queuePubkey;
      const queueAccount = new sbv2.OracleQueueAccount({
        program,
        publicKey: queueKey,
      });
      const [leaseAccount] = sbv2.LeaseAccount.fromSeed(
          program,
          queueAccount,
          aggregatorAccount
      );
      feeds.push({feed: feedPublicKey, leaseAccount});
    }
    return feeds;
}

async function getProgram(cluster: Cluster): Promise<anchor.Program> {
  const url = process.env.RPC_URL!;
  switch (cluster) {
    case "devnet": {
      const connection = new Connection(url);
      const dummyKeypair = anchor.web3.Keypair.generate();
      const wallet = new anchor.Wallet(dummyKeypair);
      const provider = new anchor.Provider(connection, wallet, {
        commitment: "processed",
        preflightCommitment: "processed",
      });
      const anchorIdl = await anchor.Program.fetchIdl(
        sbv2.SBV2_DEVNET_PID,
        provider
      );
      return new anchor.Program(anchorIdl!, sbv2.SBV2_DEVNET_PID, provider);
    }
    case "mainnet-beta": {
      {
        const connection = new Connection(url);
        const dummyKeypair = anchor.web3.Keypair.generate();
        const wallet = new anchor.Wallet(dummyKeypair);
        const provider = new anchor.Provider(connection, wallet, {
          commitment: "processed",
          preflightCommitment: "processed",
        });
        const anchorIdl = await anchor.Program.fetchIdl(
          sbv2.SBV2_MAINNET_PID,
          provider
        );
        return new anchor.Program(anchorIdl!, sbv2.SBV2_MAINNET_PID, provider);
      }
    }
    default:
      throw new Error(`not implemented for cluster ${cluster}`);
  }
}

main().then(
  () => {
    process.exit();
  },
  (err) => {
    console.error(err);
    process.exit(0);
  }
);
