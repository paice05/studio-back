import sequelize, { Op } from 'sequelize';
import ReportRepository from '../repository/Reports';
import { ReportInstance } from '../models/Reports';
import BaseResource from './BaseResource';
import ScheduleResource from './Schedules';
import ServiceResource from './Services';
import userResource from './Users';
import queuedAsyncMap from '../utils/queuedAsyncMap';
import Schedules from '../models/Schedules';

export class ReportResource extends BaseResource<ReportInstance> {
  constructor() {
    super(ReportRepository);
  }

  async saleReports({ startAt, endAt }: { startAt: Date; endAt: Date }, query) {
    const reports = await ReportRepository.findMany({
      where: {
        createdAt: {
          [Op.between]: [startAt, endAt],
        },
        ...query.where,
      },
    });

    const response = reports.reduce(
      (acc, cur) => {
        return {
          entry: acc['entry'] + cur.entry,
          out: acc['out'] + cur.out,
        };
      },
      {
        entry: 0,
        out: 0,
      }
    );

    return {
      entry: response.entry,
      out: response.out,
      countFinished: 0,
      countCanceled: 0,
      countUsers: 0,
      serviceCount: [],
      productPriceSugestion: 0,
      schedulesInfo: [],
      registerInfo: reports,
    };
  }

  async reports({ startAt, endAt }: { startAt: Date; endAt: Date }, query) {
    const defaultWhere = {
      scheduleAt: {
        [Op.between]: [startAt, endAt],
      },
    };

    const reports = await ReportRepository.findMany({
      ...query,
      include: [
        {
          model: Schedules,
          as: 'schedule',
          where: {
            ...defaultWhere,
            ...query.where,
            status: 'finished',
          },
        },
      ],
    });

    const response = reports.reduce(
      (acc, cur) => {
        return {
          entry: acc['entry'] + cur.entry,
          out: acc['out'] + cur.out,
        };
      },
      {
        entry: 0,
        out: 0,
      }
    );

    const countFinished = await ScheduleResource.count({
      where: {
        ...defaultWhere,
        ...query.where,
        status: 'finished',
      },
    });

    const countCanceled = await ScheduleResource.count({
      where: {
        ...defaultWhere,
        ...query.where,
        status: 'canceled',
      },
    });

    const countUsers = await userResource.count({
      where: {
        ...query.where,
        type: 'pf',
        createdAt: {
          [Op.between]: [startAt, endAt],
        },
      },
    });

    const services = await ServiceResource.findMany(query);

    const serviceCount = await queuedAsyncMap(services, async (item) => {
      const countService = await ScheduleResource.count({
        where: {
          ...defaultWhere,
          ...query.where,
          serviceId: item.id,
        },
      });

      return { value: countService, item };
    });

    const fiveMaxService = serviceCount
      .sort((a, b) => (a.value < b.value ? 1 : -1))
      .slice(0, 5)
      .map(({ item, value }) => ({ name: item.name, value }));

    const productPriceSugestion = response.entry * 0.1;

    const schedulesInfo = await ReportRepository.findMany({
      ...query,
      attributes: ['id'],
      include: [
        {
          model: Schedules,
          as: 'schedule',
          attributes: ['id', 'discount', 'addition'],
          include: ['service'],
          where: {
            ...defaultWhere,
            ...query.where,
            status: 'finished',
          },
        },
      ],
    });

    const registerOut = await ReportRepository.findMany({
      where: {
        createdAt: {
          [Op.between]: [startAt, endAt],
        },
        ...query.where,
      },
    });

    const valueRegisterOut = registerOut.reduce((acc, cur) => acc + cur.out, 0);

    return {
      entry: response.entry,
      out: response.out + valueRegisterOut,
      countFinished,
      countCanceled,
      countUsers,
      serviceCount: fiveMaxService,
      productPriceSugestion,
      schedulesInfo,
      registerInfo: registerOut,
    };
  }

  async createOrUpdate({
    reportId = null,
    serviceId,
    scheduleId,
    discount,
    addition,
    accountId,
  }: {
    reportId?: string | null;
    serviceId: string;
    scheduleId: string;
    discount: number;
    addition: number;
    accountId: string;
  }) {
    const service = await ServiceResource.findById(serviceId);

    let total = service.price;

    if (discount) {
      total -= discount;
    }

    if (addition) {
      total += addition;
    }

    if (reportId) {
      await ReportRepository.updateById(reportId, {
        scheduleId,
        entry: total,
        accountId,
      });

      return;
    }

    await ReportRepository.create({
      scheduleId,
      entry: total,
      accountId,
    });
  }

  async registerOut(data: {
    description: string;
    value: number;
    accountId: string;
  }) {
    return ReportRepository.create({
      accountId: data.accountId,
      out: data.value,
      description: data.description,
    });
  }
}

export default new ReportResource();
