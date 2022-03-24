import { env,PersistentMap, logging, Context, u128, ContractPromiseBatch, PersistentSet, RNG } from "near-sdk-as";

import { AccountId, ONE_NEAR, asNEAR, XCC_GAS } from "../../utils";

import { FeeStrategy, StrategyType } from "./fee-strategies";
import { Lottery } from "./lottery";





@nearBindgen
export class Contract {

  private owner: AccountId;
  private big_win: AccountId;
  private chance: f64 = 0.5;
  private bet: u32;
  private winner: AccountId;
  private last_played: AccountId;
  private active: bool = true;
  private pot: u128 = ONE_NEAR;
  private min_amount: u128 = ONE_NEAR;
  private big_win_amount: u128 = ONE_NEAR;
  private max_amount: u128 = u128.mul(u128.from(100),ONE_NEAR);
  private lottery: Lottery = new Lottery();
  private players: PersistentSet<AccountId> = new PersistentSet<AccountId>("p");
  private map: PersistentMap<AccountId,u128> = new PersistentMap<AccountId,u128>("m");
  private win: PersistentMap<AccountId,u128> = new PersistentMap<AccountId,u128>("w");
  private check: PersistentMap<AccountId,string> = new PersistentMap<AccountId,string>("c");


  constructor(owner: AccountId) {
    this.owner = owner;
  };

  // --------------------------------------------------------------------------
  // Public VIEW methods
  // --------------------------------------------------------------------------

  get_owner(): AccountId {
    return this.owner;
  }

  get_last_played(): AccountId {
    return this.last_played;
  }

  
  
  get_total_bet(player: AccountId): u128 {
    return this.map.getSome(player);
  }
  
  get_big_win(): string{
    return "player " + this.big_win +" has won " + asNEAR(this.big_win_amount).toString() + " NEAR";
  }
  
  get_total_win(player: AccountId): u128 {
    return this.win.getSome(player);
  }

  get_check(player: AccountId): string {
    return this.check.getSome(player);
  }
  

  explain_lottery(): string {
    return "Players have a " + (this.chance * 100).toString() + "% chance of winning.";
  }

  @mutateState()
  play(bet: u32): void {
    logging.log("so tien dat" + Context.attachedDeposit.toString());

    const signer = Context.sender;

    assert(Context.attachedDeposit > this.min_amount, 'bet min 1 near');
    assert(Context.attachedDeposit < this.max_amount, 'bet max 100 near');


    this.last_played = signer;   
    
    // log total bet
    if (this.map.contains(Context.sender)) {
      let get = this.map.getSome(Context.sender);
      const add = u128.add(get,Context.attachedDeposit);
      this.map.set(Context.sender,add);
    } else {
      this.map.set(Context.sender,Context.attachedDeposit)
    };
    
    
    // bet: tai xiu

    if (bet == 0 ) {
      if (this.roll()) {
        this.check.set(Context.sender,"win");
        this.win_log();
        this.winner = signer;
        this.payout();
        if (Context.attachedDeposit >= u128.mul(u128.from(10),ONE_NEAR)) {
          this.big_win = signer;
          this.big_win_amount = Context.attachedDeposit;
        }
      } else {
        this.check.set(Context.sender,"lose")
        logging.log(this.last_played + " did not win. Good luck next time");
      }
    };

    if (bet == 1 ) {
      if (this.roll()) {
        this.check.set(Context.sender,"lose")
        logging.log(this.last_played + " did not win. Good luck next time");
      } else {
        this.win_log();
        this.check.set(Context.sender,"win")
        this.winner = signer;
        if (Context.attachedDeposit >= u128.mul(u128.from(10),ONE_NEAR)) {
          this.big_win = signer;
          this.big_win_amount = Context.attachedDeposit;
        }
        this.payout();
      }
    };
  }

  @mutateState()
  roll(): bool {
    const rng = new RNG<u32>(1, u32.MAX_VALUE);
    const roll = rng.next();
    const x:i32 = roll - <u32>(<f64>u32.MAX_VALUE * this.chance);
    logging.log("roll: " + x.toString());
    return roll <= <u32>(<f64>u32.MAX_VALUE * this.chance);
  }

  
  @mutateState()
  private win_log(): void {
    if (this.win.contains(Context.sender)) {
      let get_win = this.win.getSome(Context.sender);
        const add_win = u128.add(get_win,Context.attachedDeposit);
        this.win.set(Context.sender,add_win);
    } else {
      this.win.set(Context.sender,Context.attachedDeposit)
    }
  }



  private payout(): void {
    const b = u128.add(Context.attachedDeposit,Context.attachedDeposit);
    logging.log(this.winner + " won " + asNEAR(b).toString());

    if (this.winner.length > 0) {
      const to_winner = ContractPromiseBatch.create(this.winner);
      const self = Context.contractName

      // transfer payout to winner
      to_winner.transfer(b);
    }
  }

  private assert_self(): void {
    const caller = Context.predecessor
    const self = Context.contractName
    assert(caller == self, "Only this contract may call itself");
  }
}

 
