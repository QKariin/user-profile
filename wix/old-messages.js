/**
 * Autocomplete function declaration, do not delete
 * @param {import('./__schema__.js').Payload} options
 */
import wixData from "wix-data";

export const invoke = async ({ payload }) => {
    const COLLECTION = "SlaveMessages";

    console.log("=== Automation started: Cleaning old messages ===");

    // 1. Fetch only messages missing createdAt
    const missingDate = await wixData.query(COLLECTION)
        .isEmpty("createdAt")
        .limit(1000)
        .find({ suppressAuth: true });

    console.log("Messages missing createdAt:", missingDate.items.length);

    // 2. Copy _createdDate → createdAt ONLY for those
    for (const item of missingDate.items) {
        item.createdAt = new Date(item._createdDate);
        await wixData.update(COLLECTION, item, { suppressAuth: true });
    }

    console.log("Missing createdAt fields have been filled");


    // 3. Re-query using createdA for stable sorting
    const res2 = await wixData.query(COLLECTION)
        .descending("createdAt")
        .limit(1000)
        .find({ suppressAuth: true });

    const sortedMessages = res2.items;

    // 4. Extract unique user IDs
    const userIds = [...new Set(sortedMessages.map(m => m.memberId))];
    console.log("Unique users found:", userIds.length, userIds);

    let totalMarked = 0;

    // 5. Cleanup per user
    for (const userId of userIds) {
        const marked = await cleanupUserMessages(userId);
        totalMarked += marked;
        console.log(`User ${userId}: marked ${marked} messages`);
    }

    console.log("=== Automation finished ===");
    console.log("Total messages marked across all users:", totalMarked);

    return {};
};


// Helper: cleanup messages for a single user
async function cleanupUserMessages(userId) {
    const COLLECTION = "SlaveMessages";

    // Fetch messages for this user, sorted by createdA
    const res = await wixData.query(COLLECTION)
        .eq("memberId", userId)
        .descending("createdAt")
        .limit(1000)
        .find({ suppressAuth: true });

    const items = res.items;
    console.log(`User ${userId} has ${items.length} messages`);

    if (items.length <= 50) {
        console.log(`User ${userId}: nothing to clean (<= 50 messages)`);
        return 0;
    }

    const toMark = items.slice(50);
    console.log(`User ${userId}: will mark ${toMark.length} old messages`);

    let count = 0;

    for (const item of toMark) {
        item.delete = "YES2";
        await wixData.update(COLLECTION, item, { suppressAuth: true });
        count++;
    }

    return count;
}