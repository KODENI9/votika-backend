import { processWebhook } from "./src/services/vote.service";
import { getCreatorById } from "./src/models/creator.model";
import { db } from "./src/config/firebase";

async function runTest() {
  console.log("--- STARTING END-TO-END VOTE TEST (BYPASSING MONEYFUSION) ---");
  const creatorId = "f85ca4e52794425798045"; // Afwin
  const providerRef = "TEST_TOKEN_" + Date.now();

  // 1. Check initial votes
  let creator = await getCreatorById(creatorId);
  console.log(`Initial votes for ${creator?.displayName}: ${creator?.totalVotes}`);
  const initialVotes = creator?.totalVotes || 0;

  // 2. Create a pending vote in DB directly
  console.log("Creating a pending vote in DB...");
  const voteRef = db.collection("votes").doc();
  const transactionRef = db.collection("transactions").doc();
  
  await voteRef.set({
    creatorId,
    voteCount: 1,
    amount: 200,
    transactionId: transactionRef.id,
    paymentMethod: "orange",
    status: "pending",
    voterPhone: "22890000000",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  await transactionRef.set({
    voteId: voteRef.id,
    provider: "moneyfusion",
    paymentMethod: "orange",
    amount: 200,
    currency: "XOF",
    moneyFusionRef: providerRef,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Vote created! VoteId: ${voteRef.id}, TransactionId: ${transactionRef.id}, Token: ${providerRef}`);

  // 3. Simulate a successful webhook callback
  console.log("Simulating a successful payment webhook from MoneyFusion...");
  await processWebhook(providerRef, "SUCCESS", { simulated: true });
  console.log("Webhook processed successfully.");

  // 4. Verify the votes were incremented
  creator = await getCreatorById(creatorId);
  console.log(`Final votes for ${creator?.displayName}: ${creator?.totalVotes}`);
  
  if (creator?.totalVotes === initialVotes + 1) {
    console.log("✅ TEST PASSED: The vote was successfully counted!");
  } else {
    console.log("❌ TEST FAILED: The vote was NOT counted correctly.");
  }

  process.exit(0);
}

runTest().catch(console.error);

