import cron from 'node-cron';
import db from '../models/database.js';

// 每小时执行一次：减少饱食度和生命值
export const startHungerJob = () => {
  // 每小时整点执行
  cron.schedule('0 * * * *', () => {
    console.log('⏰ 执行饥饿检查...');

    try {
      // 获取所有活着的宠物
      const pets = db.prepare(`
        SELECT * FROM pets WHERE is_alive = 1
      `).all();

      for (const pet of pets) {
        let newHunger = pet.hunger - 10;
        let newHp = pet.hp;
        let newMood = pet.mood;

        // 饱食度为0时，生命值下降
        if (newHunger <= 0) {
          newHunger = 0;
          newHp = Math.max(0, pet.hp - 20);
          newMood = Math.max(0, pet.mood - 10);
        } else {
          newMood = Math.max(0, pet.mood - 2);
        }

        // 生命值为0时，死亡
        const isAlive = newHp > 0 ? 1 : 0;

        db.prepare(`
          UPDATE pets 
          SET hunger = ?, hp = ?, mood = ?, is_alive = ?
          WHERE id = ?
        `).run(newHunger, newHp, newMood, isAlive, pet.id);

        if (!isAlive) {
          console.log(`💀 宠物 ${pet.name} (ID: ${pet.id}) 因饥饿死亡`);
        }
      }

      console.log(`✅ 饥饿检查完成，共处理 ${pets.length} 只宠物`);
    } catch (err) {
      console.error('饥饿检查失败:', err);
    }
  });

  console.log('🕐 饥饿定时任务已启动（每小时执行）');
};
