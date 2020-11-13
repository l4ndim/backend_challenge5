import csvParse from 'csv-parse';
import fs from 'fs';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: "income" | "outcome";
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    const categoryRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const readCSVStream = fs.createReadStream(filepath);

    const parseStream = csvParse({ 
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });
    
    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) => 
        cell.trim()
      );

      if(!title || !type || !value) return;
      
      categories.push(category);

      transactions.push({title, type, value, category});
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      }
    });

    const existentCategoriesTitles = existentCategories.map(category => category.title);

    const addCategoryTitles = categories.filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      addCategoryTitles.map(title => ({
        title
      }))
    );

    await categoryRepository.save(newCategories);

    const allCategories = [...newCategories, ...existentCategories];

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(cat => cat.title === transaction.category)
      }))
    );

    await transactionsRepository.save(newTransactions);

    await fs.promises.unlink(filepath);

    return newTransactions;
  }
}

export default ImportTransactionsService;
