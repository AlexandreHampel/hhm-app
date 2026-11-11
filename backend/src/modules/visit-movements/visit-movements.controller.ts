
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { VisitMovementsService } from './visit-movements.service.js';
import { VisitsError } from '../visits/visits.service.js';

export class VisitMovementsController {
  private service = new VisitMovementsService();

  create = async (req: Request, res: Response) => {
    try {
      const movement = await this.service.create(
        String(req.params.id),
        req.body
      );

      res.status(201).json(movement);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findByVisit = async (req: Request, res: Response) => {
    try {
      const movements = await this.service.findByVisit(
        String(req.params.id)
      );

      res.status(200).json(movements);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown) {
    if (error instanceof VisitsError) {
      res.status(error.statusCode).json({
        message: error.message
      });
      return;
    }

    if (error instanceof mongoose.Error.ValidationError ||
        error instanceof mongoose.Error.CastError) {
      res.status(400).json({
        message: error.message
      });
      return;
    }

    console.error('Unexpected visit movements module error:', error);

    res.status(500).json({
      message: 'Internal server error'
    });
  }
}
