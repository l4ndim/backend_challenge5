import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: "income" | "outcome";
  category: string;
}

class CreateTransactionService {
  public async execute({ title, value, type, category }: Request): Promise<Transaction> {
    const categoryRepository = getRepository(Category);
    const transactionRepository = getCustomRepository(TransactionsRepository);

    if(type === "outcome") {
      const { total } = await transactionRepository.getBalance();

      if(value > total){
        throw new AppError("This transactions it's not allowed. Outcome value exceeds your balance.")
      }
    }
    
    let transactionCategory = await categoryRepository.findOne({
      where: { title: category }
    });

    if(!transactionCategory) {
      transactionCategory = categoryRepository.create({
        title: category
      });

      await categoryRepository.save(transactionCategory);
    }


    const transaction = transactionRepository.create({
      title,
      type,
      value,
      category: transactionCategory,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
