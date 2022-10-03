import { Router } from 'express';

import categoryResource from '../../../resource/Categories';
import { promiseHandler } from '../../../utils/routing';

import controllerDefaut from '../controller';

const controller = controllerDefaut(categoryResource);

const controllerCustom = {
  findByName: promiseHandler(async (req) => {
    const response = await categoryResource.findCategoryByName(req.params.name);

    return response;
  }),
};

const router = Router();

router.get('/', controller.index);
router.get('/:id', controller.show);
router.get('/search/:name', controllerCustom.findByName);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.destroy);

export default router;
