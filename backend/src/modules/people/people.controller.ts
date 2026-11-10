
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PeopleError, PeopleService } from './people.service.js';

export class PeopleController {
  private service = new PeopleService();

  create = async (req: Request, res: Response) => {
    try {
      const person = await this.service.create(req.body);
      res.status(201).json(person);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const person = await this.service.update(
        String(req.params.id),
        req.body
      );

      res.status(200).json(person);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      await this.service.delete(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findAll = async (_req: Request, res: Response) => {
    try {
      const people = await this.service.findAll();
      res.status(200).json(people);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findById = async (req: Request, res: Response) => {
    try {
      const person = await this.service.findById(
        String(req.params.id)
      );

      res.status(200).json(person);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findByCpf = async (req: Request, res: Response) => {
    try {
      const person = await this.service.findByCpf(
        String(req.params.cpf)
      );

      res.status(200).json(person);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  findByRole = async (req: Request, res: Response) => {
    try {
      const people = await this.service.findByRole(
        String(req.params.role)
      );

      res.status(200).json(people);
    } catch (error) {
      this.handleError(res, error);
    }
  };

  private handleError(res: Response, error: unknown) {
    if (error instanceof PeopleError) {
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

    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({
        message: 'A person with this CPF already exists'
      });
      return;
    }

    console.error('Unexpected people module error:', error);

    res.status(500).json({
      message: 'Internal server error'
    });
  }
}
