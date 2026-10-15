import { parseAbi, type Abi } from "viem";
import ART from "@/lib/contracts/artifacts.json";

/* ABIs the site uses. The OSCRA ones come straight from the forge build (src/lib/contracts/artifacts.json). */

export const RUNBOOK_ABI = ART.contracts.OscraRunbook.abi as Abi;
export const KEEL_ABI = ART.contracts.OscraKeel.abi as Abi;

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);

export const FEED_ABI = parseAbi([
  "function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)",
  "function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
]);

/** Every custom error the two contracts can raise, for decoding reverts. */
export const ALL_ERRORS = [...RUNBOOK_ABI, ...KEEL_ABI].filter((x) => x.type === "error");

/** Plain words for each revert. */
export const ERROR_WORDS: Record<string, string> = {
  BadConfig: "The contract refused its setup values.",
  BadLane: "That market is not one of the Runbook's lanes.",
  BadTerms: "The contract refused one of the limits (amount, interval, slippage, tip or lanes).",
  NotOwner: "Only the wallet that opened this plan can change it.",
  NotDue: "Not due yet: the plan's next buy time has not come.",
  NotActive: "This plan is not active (held, paused by a guard or target, spent or closed).",
  AboveCeiling: "The price is above the plan's ceiling, so the buy waits.",
  StalePrice: "The Chainlink price for this market is too old to trade against right now.",
  AlreadyBound: "The Runbook is already linked to the staking contract.",
  NotBinder: "Only the deploying wallet can link the staking contract, once.",
  UnknownSignal: "There is no idea with that number.",
  NotFollowing: "This wallet does not follow that desk for this market, or the idea is older than the follow.",
  AlreadyHandled: "This idea was already copied or skipped for this wallet.",
  OutsideWindow: "Outside the copy window: wait for the review delay, or the six-hour window has closed.",
  PriceMoved: "The price moved further from the desk's price than your chase limit allows.",
  DayCapReached: "That would pass your daily spending cap for this desk.",
  PositionCapReached: "That would pass your position cap for this desk on this market.",
  NothingToSell: "There is nothing copied from this desk on this market to sell.",
  AmountTooSmall: "The amount is below one USDG (or rounds to nothing).",
  IncomingMismatch: "The token moved a different amount than requested (fee-on-transfer tokens are refused).",
  Reentered: "Refused a nested call.",
  OscraWireFailed: "The token transfer failed (balance, allowance or a blocked address).",
  ZeroAmount: "Enter an amount above zero (and not more than you have staked).",
  Locked: "Your stake is locked until the last poll you voted in closes.",
  TooLittleStake: "Not enough $OSCRA staked for that.",
  BadPoll: "The poll needs a title, 2 to 6 choices and a length of 1 to 14 days.",
  PollClosed: "This poll has closed.",
  AlreadyVoted: "This wallet already voted in this poll.",
  AuthorBusy: "You already have a poll running; open the next one after it closes.",
};
